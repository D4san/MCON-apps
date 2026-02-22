import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Square, Eraser, Info, MousePointer2, Settings, X } from 'lucide-react';
import { useIsPortrait } from '../../hooks/useIsPortrait';

// --- Types ---
interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
}

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

type GameStatus = 'idle' | 'trying' | 'success';

// --- Constants ---
const PARTICLE_RADIUS = 1.8;
const MAX_PLOT_POINTS = 100;
const MAP_OVERLAY_WIDTH = 150;
const MAP_OVERLAY_HEIGHT = 112;
const PLOT_OVERLAY_WIDTH = 200;
const PLOT_OVERLAY_HEIGHT = 120;
const PADDING = 10;
const GRID_CELL_SIZE = 15;

const DiscreteContinuous = () => {
    // --- State (UI) ---
    const [particleCount, setParticleCount] = useState(300);
    const [speed, setSpeed] = useState(2.0);
    const [targetError, setTargetError] = useState(0.05);
    const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
    const [feedback, setFeedback] = useState("Define un volumen para empezar...");
    const [configOpen, setConfigOpen] = useState(false);
    const isPortrait = useIsPortrait();

    // --- Refs (Simulation State) ---
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    
    // Volume & Interaction
    const volumeRef = useRef<Rect | null>(null);
    const dragStartRef = useRef<{x: number, y: number} | null>(null);
    const currentDragRef = useRef<Rect | null>(null);
    const isDrawingRef = useRef(false);

    // Data History
    const instantHistoryRef = useRef<number[]>([]);
    const globalHistoryRef = useRef<number[]>([]);
    const globalAvgRef = useRef(0);

    // --- Init Simulation ---
    const initSimulation = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const newParticles: Particle[] = [];
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const pSpeed = speed * (0.5 + Math.random());
            newParticles.push({
                x: Math.random() * (canvas.width - 2 * PARTICLE_RADIUS) + PARTICLE_RADIUS,
                y: Math.random() * (canvas.height - 2 * PARTICLE_RADIUS) + PARTICLE_RADIUS,
                vx: Math.cos(angle) * pSpeed,
                vy: Math.sin(angle) * pSpeed
            });
        }
        particlesRef.current = newParticles;

        // Calc global avg
        const area = canvas.width * canvas.height;
        globalAvgRef.current = area > 0 ? (newParticles.length / area) * 1000 : 0;
        
        // Reset histories
        globalHistoryRef.current = Array(MAX_PLOT_POINTS).fill(globalAvgRef.current);
        instantHistoryRef.current = Array(MAX_PLOT_POINTS).fill(0);
        
        if (volumeRef.current) {
            // Keep volume but reset data? Logic implies reset data usually
            instantHistoryRef.current = Array(MAX_PLOT_POINTS).fill(0);
        }
    }, [particleCount, speed]); // Run when count/speed changes logic handled via effect/handlers

    // --- Main Loop ---
    const animate = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // 1. Clear
        ctx.fillStyle = '#111827'; // gray-900
        ctx.fillRect(0, 0, width, height);

        // 2. Move & Draw Particles
        const vol = volumeRef.current;
        
        particlesRef.current.forEach(p => {
            // Move
            p.x += p.vx;
            p.y += p.vy;

            // Bounce
            if (p.x < PARTICLE_RADIUS || p.x > width - PARTICLE_RADIUS) {
                p.vx *= -1;
                p.x = Math.max(PARTICLE_RADIUS, Math.min(width - PARTICLE_RADIUS, p.x));
            }
            if (p.y < PARTICLE_RADIUS || p.y > height - PARTICLE_RADIUS) {
                p.vy *= -1;
                p.y = Math.max(PARTICLE_RADIUS, Math.min(height - PARTICLE_RADIUS, p.y));
            }

            // check in volume
            const inVol = vol && 
                p.x >= vol.x && p.x <= vol.x + vol.width &&
                p.y >= vol.y && p.y <= vol.y + vol.height;

            // Draw
            ctx.beginPath();
            ctx.arc(p.x, p.y, PARTICLE_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = inVol ? '#f472b6' : '#67e8f9'; // Pink vs Cyan
            ctx.fill();
        });

        // 3. Updates & Logic
        updateDataAndStatus();

        // 4. Draw Overlays
        drawGlobalDensityMap(ctx);
        drawPlotOverlay(ctx);
        drawSelection(ctx);

        requestRef.current = requestAnimationFrame(animate);
    }, [targetError]); // Dependency on targetError for status check if inside loop? 
    // Actually status update usually needs targetError. 
    // BUT animating with state dependencies can be tricky if not careful.
    // 'targetError' is used in updateDataAndStatus. 
    // To avoid recreating loop constantly, we can use a ref for targetError or just include it.

    // --- Logic Helpers ---
    const updateDataAndStatus = () => {
        const vol = volumeRef.current;
        let diff = 0; // for status
        
        if (vol) {
            let count = 0;
            particlesRef.current.forEach(p => {
                if (p.x >= vol.x && p.x <= vol.x + vol.width &&
                    p.y >= vol.y && p.y <= vol.y + vol.height) {
                    count++;
                }
            });
            const area = Math.max(1, vol.width * vol.height);
            const density = (count / area) * 1000;
            
            instantHistoryRef.current.push(density);
            
            if (globalAvgRef.current > 0) {
                diff = Math.abs(density - globalAvgRef.current) / globalAvgRef.current;
            }
        } else {
            instantHistoryRef.current.push(0);
        }

        globalHistoryRef.current.push(globalAvgRef.current);

        // Cap lengths
        if (instantHistoryRef.current.length > MAX_PLOT_POINTS) instantHistoryRef.current.shift();
        if (globalHistoryRef.current.length > MAX_PLOT_POINTS) globalHistoryRef.current.shift();

        // Status Update (debounced ideally, but per frame is ok for text)
        // We shouldn't set state every frame if it hasn't changed to avoid re-renders
        if (vol) {
            const newStatus = diff <= targetError ? 'success' : 'trying';
            // Only update if different to avoid React render spam
            // But we can't easily check 'state' inside this callback without refs.
            // Let's rely on a ref for current status or just set it.
            // Actually, setting state every frame is BAD. 
            // We'll update the FEEDBACK text ref or just render it on canvas? 
            // The original used DOM for feedback. 
            // Let's implement a ref-based check.
           // For now, let's just do it in the React way: only set if changed.
           // Accessing previous state in setState updater is possible.
           setGameStatus(prev => {
               if (prev !== newStatus) return newStatus;
               return prev;
           });
        } else {
            setGameStatus(prev => prev !== 'idle' ? 'idle' : prev);
        }
    };

    const drawGlobalDensityMap = (ctx: CanvasRenderingContext2D) => {
        const w = MAP_OVERLAY_WIDTH;
        const h = MAP_OVERLAY_HEIGHT;
        const x = ctx.canvas.width - w - PADDING;
        const y = PADDING;

        ctx.save();
        ctx.translate(x, y);
        
        ctx.fillStyle = 'rgba(31, 41, 55, 0.7)';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(75, 85, 99, 0.8)';
        ctx.strokeRect(0, 0, w, h);

        const rows = Math.ceil(h / GRID_CELL_SIZE);
        const cols = Math.ceil(w / GRID_CELL_SIZE);
        const grid = Array(rows).fill(0).map(() => Array(cols).fill(0));
        let maxD = 0;

        const scaleX = w / ctx.canvas.width;
        const scaleY = h / ctx.canvas.height;

        particlesRef.current.forEach(p => {
            const r = Math.floor((p.y * scaleY) / GRID_CELL_SIZE);
            const c = Math.floor((p.x * scaleX) / GRID_CELL_SIZE);
            if (r >= 0 && r < rows && c >= 0 && c < cols) {
                grid[r][c]++;
                if (grid[r][c] > maxD) maxD = grid[r][c];
            }
        });

        if (maxD > 0) {
            for(let r=0; r<rows; r++){
                for(let c=0; c<cols; c++){
                    const d = grid[r][c];
                    if (d === 0) continue;
                    const norm = Math.min(1, d / maxD);
                    const hue = 60 - 60 * norm;
                    ctx.fillStyle = `hsla(${hue}, 95%, 40%, ${0.7 + 0.3*norm})`;
                    ctx.fillRect(c*GRID_CELL_SIZE, r*GRID_CELL_SIZE, GRID_CELL_SIZE, GRID_CELL_SIZE);
                }
            }
        }
        ctx.restore();
    };

    const drawPlotOverlay = (ctx: CanvasRenderingContext2D) => {
        const w = PLOT_OVERLAY_WIDTH;
        const h = PLOT_OVERLAY_HEIGHT;
        const x = ctx.canvas.width - w - PADDING;
        const y = ctx.canvas.height - h - PADDING;

        ctx.save();
        ctx.translate(x, y);
        
        ctx.fillStyle = 'rgba(31, 41, 55, 0.7)';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(75, 85, 99, 0.8)';
        ctx.strokeRect(0, 0, w, h);

        const data1 = instantHistoryRef.current; // Cyan
        const data2 = globalHistoryRef.current; // Yellow (Avg)
        if (data1.length < 2) { ctx.restore(); return; }

        const maxVal = Math.max(...data1, ...data2, globalAvgRef.current * 1.5, 1);
        const minVal = 0;
        const range = maxVal - minVal;

        // Draw Line Helper
        const drawLine = (data: number[], color: string) => {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            data.forEach((val, i) => {
                const px = PADDING + (i / (MAX_PLOT_POINTS-1)) * (w - 2*PADDING);
                const py = h - PADDING - ((val - minVal) / range) * (h - 2*PADDING);
                if (i===0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.stroke();
        };

        drawLine(data1, '#22d3ee');
        drawLine(data2, '#facc15');

        ctx.restore();
    };

    const drawSelection = (ctx: CanvasRenderingContext2D) => {
        if (isDrawingRef.current && currentDragRef.current) {
            const { x, y, width, height } = currentDragRef.current;
            ctx.strokeStyle = '#f87171'; ctx.setLineDash([3,3]);
            ctx.strokeRect(x, y, width, height);
            ctx.setLineDash([]);
        }
        
        const vol = volumeRef.current;
        if (vol) {
            ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 2; ctx.setLineDash([5,5]);
            ctx.strokeRect(vol.x, vol.y, vol.width, vol.height);
            ctx.setLineDash([]);
        }
    };

    // --- Interaction Handlers ---
    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return {x:0, y:0};
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        const pos = getPos(e);
        dragStartRef.current = pos;
        isDrawingRef.current = true;
        volumeRef.current = null;
        currentDragRef.current = null;
        setGameStatus('idle');
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current || !dragStartRef.current) return;
        const pos = getPos(e);
        const start = dragStartRef.current;
        const w = Math.abs(pos.x - start.x);
        const h = Math.abs(pos.y - start.y);
        const x = Math.min(pos.x, start.x);
        const y = Math.min(pos.y, start.y);
        currentDragRef.current = { x, y, width: w, height: h };
    };

    const handleMouseUp = () => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        if (currentDragRef.current && currentDragRef.current.width > 5 && currentDragRef.current.height > 5) {
            volumeRef.current = currentDragRef.current;
            instantHistoryRef.current = []; // Reset history for new volume?
        }
        currentDragRef.current = null;
    };


    // Side effects needed for animation loop to see fresh state? 
    // `animate` is created via useCallback with deps `[targetError]`. 
    // If targetError changes, animate is recreated.
    // We need to make sure the loop uses the latest `animate`.
    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [animate]);

    useEffect(() => {
        initSimulation(); // Run on mount and parameter change
    }, [initSimulation]);

    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current && canvasRef.current.parentElement) {
                const p = canvasRef.current.parentElement;
                canvasRef.current.width = p.clientWidth;
                canvasRef.current.height = p.clientHeight; // Fill container exactly
                initSimulation(); // re-init on resize
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [initSimulation]);


    // Update feedback text based on status
    useEffect(() => {
        if (gameStatus === 'idle') setFeedback("Define un volumen (drag & drop) para empezar...");
        else if (gameStatus === 'trying') setFeedback(`Intentando mantener error < ${(targetError*100).toFixed(0)}%...`);
        else if (gameStatus === 'success') setFeedback(`¡Logrado! Error bajo control.`);
    }, [gameStatus, targetError]);

    return (
        <div className="w-full h-full text-slate-200 font-sans flex flex-col items-center relative min-h-0">
            {/* Portrait: Floating config toggle */}
            {isPortrait && (
                <button
                    onClick={() => setConfigOpen(!configOpen)}
                    className="fixed bottom-4 right-4 z-50 p-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full shadow-lg shadow-cyan-900/40 transition-all"
                >
                    {configOpen ? <X size={22} /> : <Settings size={22} />}
                </button>
            )}

            {/* Portrait backdrop */}
            {isPortrait && configOpen && (
                <div className="fixed inset-0 bg-black/50 z-30" onClick={() => setConfigOpen(false)} />
            )}
            
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2 p-1">
                Simulador Discreto-Continuo
            </h1>

            <div className={`flex-1 min-h-0 w-full max-w-7xl px-1 md:px-2 ${
                isPortrait
                    ? 'flex flex-col gap-3 overflow-y-auto custom-scrollbar'
                    : 'grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3 h-full'
            }`}>
                
                {/* Visualizer Area */}
                <div className="flex-1 min-h-0 flex flex-col gap-3">
                    <div className="flex-1 min-h-0 relative w-full bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden cursor-crosshair touch-none"
                         onMouseDown={handleMouseDown}
                         onMouseMove={handleMouseMove}
                         onMouseUp={handleMouseUp}
                         onMouseLeave={handleMouseUp}
                         onTouchStart={handleMouseDown}
                         onTouchMove={handleMouseMove}
                         onTouchEnd={handleMouseUp}
                    >
                        <canvas ref={canvasRef} className="block w-full h-full" />
                        
                        {/* Overlay Hint */}
                        <div className="absolute top-4 left-4 pointer-events-none opacity-50 text-xs text-slate-400">
                           <MousePointer2 size={12} className="inline mr-1"/>
                           Arrastra para definir Volumen de Control
                        </div>
                    </div>
                </div>

                {/* Controls Sidebar */}
                <div className={`flex flex-col gap-3 shrink-0 ${
                    isPortrait
                        ? `fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto transform transition-transform duration-300 ease-in-out ${configOpen ? 'translate-y-0' : 'translate-y-full'} bg-slate-950 p-4 rounded-t-2xl border-t border-slate-800`
                        : 'min-h-0 overflow-y-auto custom-scrollbar pr-1'
                }`}>
                    
                    {/* Params */}
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg space-y-3">
                        <h3 className="font-bold text-sm text-slate-300 flex items-center gap-2"><Square size={16}/> Parámetros</h3>
                        
                        <div>
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                                <span>Partículas</span>
                                <span>{particleCount}</span>
                            </div>
                            <input type="range" min="50" max="1500" value={particleCount} onChange={e => setParticleCount(parseInt(e.target.value))} className="w-full accent-cyan-500"/>
                        </div>
                        
                        <div>
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                                <span>Velocidad</span>
                                <span>{speed.toFixed(1)}</span>
                            </div>
                            <input type="range" min="0.5" max="10" step="0.1" value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} className="w-full accent-cyan-500"/>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={initSimulation} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors text-slate-300 font-medium flex justify-center items-center gap-2">
                                <RefreshCw size={14}/> Reiniciar
                            </button>
                            <button onClick={() => { volumeRef.current = null; setGameStatus('idle'); }} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors text-slate-300 font-medium flex justify-center items-center gap-2">
                                <Eraser size={14}/> Limpiar
                            </button>
                        </div>
                    </div>

                    {/* Game Mode */}
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg space-y-3">
                        <h3 className="font-bold text-sm text-slate-300 flex items-center gap-2"><Info size={16}/> Desafío de Estabilidad</h3>
                        
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Margen de Error Permitido</label>
                            <select 
                                value={targetError} 
                                onChange={e => setTargetError(parseFloat(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-300"
                            >
                                <option value={0.1}>10% (Fácil)</option>
                                <option value={0.05}>5% (Medio)</option>
                                <option value={0.01}>1% (Difícil)</option>
                            </select>
                        </div>

                        <div className={`p-3 rounded-lg text-center font-medium text-sm transition-colors border ${
                            gameStatus === 'idle' ? 'bg-slate-800 border-slate-700 text-slate-400' :
                            gameStatus === 'trying' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                            'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}>
                            {feedback}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/50 text-xs text-slate-400 space-y-1">
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-cyan-400"/> Densidad Instantánea (Volumen)</div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-400"/> Densidad Promedio Global</div>
                        <div className="mt-2 text-[10px] text-slate-500 text-center italic">Gráfico visible en esquinas del simulador</div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default DiscreteContinuous;
