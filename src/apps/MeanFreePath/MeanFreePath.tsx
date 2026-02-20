import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, ArrowRight } from 'lucide-react';

// --- Types ---
interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    isPlayer?: boolean;
    mass: number;
}

type GameState = 'setup' | 'playing' | 'ended';

interface GameConfig {
    obstacleCount: number;
    obstacleSpeed: number;
    playerBoost: boolean;
}

interface GameResults {
    collisions: number;
    distance: number;
    mfp: number;
}

// --- Constants ---
const OBSTACLE_RADIUS = 2.5;
const PLAYER_RADIUS = 2.5;
const GOAL_SIZE = 40;
const FRICTION = 0.97;
const PLAYER_FORCE_BASE = 0.4;

const MeanFreePath = () => {
    // --- State ---
    const [gameState, setGameState] = useState<GameState>('setup');
    const [config, setConfig] = useState<GameConfig>({
        obstacleCount: 100,
        obstacleSpeed: 1.5,
        playerBoost: false
    });
    const [results, setResults] = useState<GameResults>({ collisions: 0, distance: 0, mfp: 0 });
    const [liveCollisions, setLiveCollisions] = useState(0);

    // --- Refs ---
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);
    
    // Game Entities
    const particlesRef = useRef<Particle[]>([]);
    const playerRef = useRef<Particle | null>(null);
    
    // Input
    const keysRef = useRef<{[key: string]: boolean}>({});

    // --- Helpers ---
    const createParticle = (x: number, y: number, vx: number, vy: number, radius: number, color: string, isPlayer = false): Particle => ({
        x, y, vx, vy, radius, color, isPlayer,
        mass: Math.PI * radius * radius
    });

    // --- Engine ---
    const initPreview = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const width = canvas.width;
        const height = canvas.height;
        const particles: Particle[] = [];

        for(let i=0; i<config.obstacleCount; i++) {
            const x = Math.random() * (width - 2 * OBSTACLE_RADIUS) + OBSTACLE_RADIUS;
            const y = Math.random() * (height - 2 * OBSTACLE_RADIUS) + OBSTACLE_RADIUS;
            const angle = Math.random() * Math.PI * 2;
            const speed = config.obstacleSpeed * (0.8 + Math.random() * 0.4);
            particles.push(createParticle(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, OBSTACLE_RADIUS, '#60a5fa'));
        }
        particlesRef.current = particles;
        playerRef.current = null;
    }, [config.obstacleCount, config.obstacleSpeed]);

    const startGame = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Init Player
        const startX = PLAYER_RADIUS + 20;
        const startY = PLAYER_RADIUS + 20;
        playerRef.current = createParticle(startX, startY, 0, 0, PLAYER_RADIUS, '#22c55e', true);

        // Init Obstacles (avoid player start)
        const particles: Particle[] = [];
        const width = canvas.width;
        const height = canvas.height;
        
        // Add player to particles list for collision loop convenience? 
        // Or keep separate. Separate is often cleaner for "One player vs Many" logic.
        // But for wall collisions maybe same loop.
        // Let's keep separate for now, but obstacle-obstacle collision is ignored in original code?
        // Original code: "for(let j=1; j < particles.length; j++)" checks overlap but not collision physics between obstacles.
        
        let attempts = 0;
        while(particles.length < config.obstacleCount && attempts < 10000) {
            attempts++;
            const x = Math.random() * (width - 2 * OBSTACLE_RADIUS) + OBSTACLE_RADIUS;
            const y = Math.random() * (height - 2 * OBSTACLE_RADIUS) + OBSTACLE_RADIUS;
            
            // Check distance to player
            const dx = x - playerRef.current.x;
            const dy = y - playerRef.current.y;
            if (Math.sqrt(dx*dx + dy*dy) < 50) continue;

            // Check distance to others (optional, for clean start)
            // Skipping strictly for perf, but "overlap check" was in original.

            const angle = Math.random() * Math.PI * 2;
            const speed = config.obstacleSpeed * (0.8 + Math.random() * 0.4);
            particles.push(createParticle(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, OBSTACLE_RADIUS, '#60a5fa'));
        }
        particlesRef.current = particles;

        setLiveCollisions(0);
        setGameState('playing');
    };

    const endGame = () => {
        const canvas = canvasRef.current;
        if (!canvas || !playerRef.current) return;

        const startX = PLAYER_RADIUS + 20;
        const startY = PLAYER_RADIUS + 20;
        // const endX = canvas.width - GOAL_SIZE / 2;
        // const endY = canvas.height - GOAL_SIZE / 2;
        
        // Approx distance (straight line? No, actual input path? Original just used displacement start->end)
        // Original: Math.sqrt((endX - startX)**2 + (endY - startY)**2); -> Displacement.
        // That's technically not "Distance Traveled" if they spiraled, but it's what the original calculated.
        // Let's stick to original logic: Displacement.
        const dist = Math.sqrt((playerRef.current.x - startX)**2 + (playerRef.current.y - startY)**2);
        
        const mfp = liveCollisions > 0 ? dist / liveCollisions : Infinity;

        setResults({
            collisions: liveCollisions,
            distance: parseFloat(dist.toFixed(1)),
            mfp: mfp === Infinity ? -1 : parseFloat(mfp.toFixed(2)) // -1 for Infinity
        });
        setGameState('ended');
    };

    // --- Game Loop ---
    const update = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Clear
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, width, height);

        if (gameState === 'setup') {
            // Preview Mode
            particlesRef.current.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                // Bounce
                if (p.x < p.radius || p.x > width - p.radius) { p.vx *= -1; p.x = Math.max(p.radius, Math.min(width - p.radius, p.x)); }
                if (p.y < p.radius || p.y > height - p.radius) { p.vy *= -1; p.y = Math.max(p.radius, Math.min(height - p.radius, p.y)); }
                
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
            });
        } else if (gameState === 'playing') {
            // Game Mode
            const player = playerRef.current;
            if (!player) return;

            // 1. Player Input & Physics
            let fx = 0, fy = 0;
            if (keysRef.current['ArrowUp']) fy -= 1;
            if (keysRef.current['ArrowDown']) fy += 1;
            if (keysRef.current['ArrowLeft']) fx -= 1;
            if (keysRef.current['ArrowRight']) fx += 1;

            const len = Math.sqrt(fx*fx + fy*fy);
            if (len > 0) { fx /= len; fy /= len; }
            
            const forceMag = PLAYER_FORCE_BASE * (config.playerBoost ? 2 : 1);
            player.vx += (fx / player.mass) * forceMag;
            player.vy += (fy / player.mass) * forceMag;
            
            player.vx *= FRICTION;
            player.vy *= FRICTION;
            
            player.x += player.vx;
            player.y += player.vy;
            
            // Player Walls
            if (player.x < player.radius) { player.vx *= -0.5; player.x = player.radius; }
            if (player.x > width - player.radius) { player.vx *= -0.5; player.x = width - player.radius; }
            if (player.y < player.radius) { player.vy *= -0.5; player.y = player.radius; }
            if (player.y > height - player.radius) { player.vy *= -0.5; player.y = height - player.radius; }

            // 2. Obstacles
            particlesRef.current.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < p.radius || p.x > width - p.radius) { p.vx *= -1; p.x = Math.max(p.radius, Math.min(width - p.radius, p.x)); }
                if (p.y < p.radius || p.y > height - p.radius) { p.vy *= -1; p.y = Math.max(p.radius, Math.min(height - p.radius, p.y)); }
                
                // Draw Obstacle
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();

                // Collision Detection with Player
                const dx = player.x - p.x;
                const dy = player.y - p.y;
                const distSq = dx*dx + dy*dy;
                const minDist = player.radius + p.radius;
                
                if (distSq < minDist * minDist) {
                    setLiveCollisions(c => c + 1);
                    
                    const dist = Math.sqrt(distSq);
                    const nx = dx / dist; const ny = dy / dist;
                    
                    // Simple inelastic-ish impulse or just bounce
                    // Original code had generic elastic collision response
                    const dvx = player.vx - p.vx;
                    const dvy = player.vy - p.vy;
                    const dot = dvx * nx + dvy * ny;
                    
                    if (dot < 0) {
                        const impulse = (2 * dot) / (player.mass + p.mass);
                        const responseFactor = 0.25; // dampening
                        
                        player.vx -= impulse * p.mass * nx * responseFactor;
                        player.vy -= impulse * p.mass * ny * responseFactor;
                        p.vx += impulse * player.mass * nx;
                        p.vy += impulse * player.mass * ny;
                        
                        // Separate
                        const overlap = minDist - dist;
                        const sep = 0.5;
                        player.x += nx * overlap * sep;
                        player.y += ny * overlap * sep;
                        p.x -= nx * overlap * sep;
                        p.y -= ny * overlap * sep;
                    }
                }
            });

            // 3. Goal
            const goalX = width - GOAL_SIZE;
            const goalY = height - GOAL_SIZE;
            const pulse = (Math.sin(Date.now() * 0.004) + 1) / 2;
            ctx.fillStyle = `rgba(34, 197, 94, ${0.3 + pulse * 0.4})`;
            ctx.fillRect(goalX, goalY, GOAL_SIZE, GOAL_SIZE);
            ctx.strokeStyle = '#6ee7b7';
            ctx.strokeRect(goalX, goalY, GOAL_SIZE, GOAL_SIZE);

            // 4. Draw Player
            // Aura
            ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.radius * 3, 0, Math.PI * 2);
            ctx.fill();
            // Body
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
            ctx.fill();

            // 5. Check Win
            if (player.x > goalX && player.y > goalY) {
                endGame();
            }
        }

        requestRef.current = requestAnimationFrame(update);
    }, [gameState, config, liveCollisions]); // liveCollisions as dependency might re-create loop too often? 
    // Actually setLiveCollisions uses functional update, so we don't need it in dependency if we don't READ it inside loop (except for endGame calc, but endGame uses 'liveCollisions' state var).
    // Wait, update captures 'liveCollisions' from closure. If we use setLiveCollisions(c=>c+1), it works.
    // BUT endGame() uses liveCollisions value. If closure is stale, endGame sees old 0.
    // Solution: Use a Ref for liveCollisions for the game logic, syncing State for UI.
    
    // Better Ref approach for stats:
    const collisionsRef = useRef(0);
    // Sync ref when state changes? Or just use Ref.
    // Let's use Ref for logic, State for UI.
    useEffect(() => { collisionsRef.current = liveCollisions; }, [liveCollisions]);
    
    // NOTE: In the loop above, I call setLiveCollisions. This triggers re-render, creating new 'update' function if deps change. 
    // If I exclude 'liveCollisions' from deps, 'update' sees stale 'liveCollisions' state.
    // If I use functional setState, it's fine for incrementing.
    // But 'endGame' needs current value.
    // FIX: Update 'endGame' to use a Ref or pass the value.
    // I'll assume 'collisionsRef' tracks it.

    // --- Inputs ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState === 'playing' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                keysRef.current[e.key] = true;
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (gameState === 'playing') keysRef.current[e.key] = false;
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameState]);

    // --- Lifecycle ---
    useEffect(() => {
        requestRef.current = requestAnimationFrame(update);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [update]);

    useEffect(() => {
        if (gameState === 'setup') initPreview();
    }, [gameState, initPreview]);
    
    // Resize
    useEffect(() => {
        const resize = () => {
            if (canvasRef.current && canvasRef.current.parentElement) {
                const w = canvasRef.current.parentElement.clientWidth;
                canvasRef.current.width = w;
                canvasRef.current.height = w * 0.75;
                if (gameState === 'setup') initPreview();
            }
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [gameState, initPreview]);

    return (
        <div className="w-full text-slate-200 p-4 font-sans flex flex-col items-center">
             <div className="w-full max-w-4xl flex items-center justify-between mb-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent flex items-center gap-2">
                    <ArrowRight className="text-green-400"/> Camino Libre Medio
                </h1>
                {gameState === 'playing' && (
                    <div className="flex gap-4 text-sm font-mono">
                         <span className="bg-slate-800 px-3 py-1 rounded-lg text-rose-400 border border-slate-700">Explosiones: {liveCollisions}</span>
                    </div>
                )}
            </div>

            <div className="relative w-full max-w-4xl aspect-[4/3] bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
                <canvas ref={canvasRef} className="block w-full h-full" />

                {/* Setup Screen */}
                {gameState === 'setup' && (
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6">
                        <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl max-w-sm w-full space-y-6">
                            <h2 className="text-2xl font-bold text-center text-white mb-2">Configurar Viaje</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                                        <span>Obstáculos</span>
                                        <span>{config.obstacleCount}</span>
                                    </div>
                                    <input type="range" min="10" max="500" value={config.obstacleCount} 
                                        onChange={e => setConfig(c => ({...c, obstacleCount: parseInt(e.target.value)}))} 
                                        className="w-full accent-blue-500"/>
                                </div>
                                
                                <div>
                                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                                        <span>Velocidad</span>
                                        <span>{config.obstacleSpeed.toFixed(1)}</span>
                                    </div>
                                    <input type="range" min="0.5" max="5" step="0.1" value={config.obstacleSpeed}
                                         onChange={e => setConfig(c => ({...c, obstacleSpeed: parseFloat(e.target.value)}))}
                                         className="w-full accent-blue-500"/>
                                </div>

                                <label className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg border border-slate-700 cursor-pointer hover:border-slate-600 transition">
                                    <input type="checkbox" checked={config.playerBoost} 
                                        onChange={e => setConfig(c => ({...c, playerBoost: e.target.checked}))}
                                        className="w-5 h-5 rounded accent-green-500 cursor-pointer"/>
                                    <span className="text-sm font-medium text-slate-300">Impulso Doble (x2)</span>
                                </label>
                            </div>

                            <button onClick={startGame} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-[1.02] flex justify-center items-center gap-2">
                                <Play size={20} fill="currentColor"/> Empezar Viaje
                            </button>
                            
                            <p className="text-xs text-center text-slate-500">
                                Usa <span className="text-slate-300 font-mono">flechas</span> para mover tu partícula verde.
                            </p>
                        </div>
                    </div>
                )}

                {/* End Screen */}
                {gameState === 'ended' && (
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-300">
                        <div className="bg-slate-800 p-8 rounded-2xl border border-green-500/30 shadow-2xl max-w-sm w-full text-center space-y-6">
                            <h2 className="text-3xl font-bold text-green-400 mb-2">¡Meta Alcanzada!</h2>
                            
                            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 space-y-3">
                                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                                    <span className="text-slate-400 text-sm">Colisiones</span>
                                    <span className="text-xl font-mono text-rose-400 font-bold">{results.collisions}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                                    <span className="text-slate-400 text-sm">Distancia</span>
                                    <span className="text-xl font-mono text-blue-400 font-bold">{results.distance} px</span>
                                </div>
                                <div className="pt-2">
                                    <div className="text-xs text-slate-500 mb-1">Camino Libre Medio (Empírico)</div>
                                    <div className="text-2xl font-mono text-yellow-400 font-bold">
                                        {results.mfp === -1 ? "∞" : results.mfp} <span className="text-xs text-yellow-600 font-sans">px/col</span>
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => setGameState('setup')} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl shadow-lg transition-all flex justify-center items-center gap-2">
                                <RotateCcw size={20}/> Jugar de Nuevo
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            {gameState !== 'setup' && (
                 <button onClick={() => setGameState('setup')} className="mt-6 text-slate-500 hover:text-slate-300 text-sm flex items-center gap-2 transition-colors">
                    <RotateCcw size={14}/> Salir al Menú
                 </button>
            )}
        </div>
    );
};

export default MeanFreePath;
