import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Eraser, PenTool, Layers, Droplets, Trash2, X, Target, Download } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useIsPortrait } from '../../hooks/useIsPortrait';

// --- Constants ---
const GRID_COLS = 30;
const GRID_ROWS = 20;
const METERS_PER_CELL = 0.5;
const PLANE_DEPTH_METERS = 1;
const WALL_FACE_AREA = METERS_PER_CELL * PLANE_DEPTH_METERS;
const ATM_PRESSURE = 101.325; // kPa
const WATER_DENSITY = 1000;
const WATER_COLOR = 'rgba(0, 230, 255, 0.65)'; // Neon cyan
const GRAVITY_MIN = 0.5;
const GRAVITY_MAX = 28.0;

const GRAVITY_REFS = [
    { name: 'Luna', g: 1.62 },
    { name: 'Marte', g: 3.72 },
    { name: 'Tierra', g: 9.81 },
    { name: 'Júpiter', g: 24.79 },
];

type ToolMode = 'draw' | 'erase' | 'addWater' | 'removeWater';
interface SimState { wallGrid: boolean[][]; }

// --- Hybrid Exact Topological Fluid Solver ---
function updateSurfacesAndTick(grid: Float32Array[], walls: boolean[][]): Float32Array[] {
    const R = GRID_ROWS, C = GRID_COLS;
    const surfaceMap = Array.from({length: R}, () => new Float32Array(C).fill(-1));
    
    for (let pass = 0; pass < 3; pass++) {
        const nextGrid = grid.map(row => new Float32Array(row));
        for (let r = R - 2; r >= 0; r--) {
            for (let c = 0; c < C; c++) {
                if (walls[r][c] || grid[r][c] < 0.01) continue;
                const m = grid[r][c];
                if (!walls[r+1][c]) {
                    const space = 1.0 - nextGrid[r+1][c];
                    if (space > 0) {
                        const flow = Math.min(m, space, 0.4); 
                        nextGrid[r][c] -= flow;
                        nextGrid[r+1][c] += flow;
                    }
                }
            }
        }
        for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) grid[r][c] = nextGrid[r][c];

        const visited = Array.from({length: R}, () => new Array(C).fill(false));
        for (let startR = 0; startR < R; startR++) {
            for (let startC = 0; startC < C; startC++) {
                if (!visited[startR][startC] && grid[startR][startC] > 0.05 && !walls[startR][startC]) {
                    const comp: Array<{r: number, c: number}> = [];
                    const q = [{r: startR, c: startC}];
                    visited[startR][startC] = true;
                    
                    while (q.length > 0) {
                        const curr = q.shift()!;
                        comp.push(curr);
                        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                            const nr = curr.r + dr, nc = curr.c + dc;
                            if (nr >= 0 && nr < R && nc >= 0 && nc < C && !walls[nr][nc]) {
                                if (!visited[nr][nc] && grid[nr][nc] > 0.01) {
                                    visited[nr][nc] = true;
                                    q.push({r: nr, c: nc});
                                }
                            }
                        }
                    }
                    
                    const providers: {r: number, c: number, h: number, m: number}[] = [];
                    const receivers: {r: number, c: number, h: number}[] = [];
                    const recVisited = Array.from({length: R}, () => new Array(C).fill(false));
                    
                    const addRec = (r: number, c: number, h: number) => {
                        if (r < 0 || r >= R || c < 0 || c >= C || walls[r][c]) return;
                        if (!recVisited[r][c]) {
                            recVisited[r][c] = true;
                            receivers.push({r, c, h});
                        }
                    };

                    let minH = 999;
                    for (const cell of comp) {
                        const {r, c} = cell;
                        const m = grid[r][c];
                        const h = r + 1 - m; 
                        if (h < minH) minH = h;
                        
                        providers.push({r, c, h, m: grid[r][c]});
                        
                        if (m < 0.98) addRec(r, c, h);
                        
                        if (r > 0 && grid[r-1][c] <= 0.02) addRec(r-1, c, r);
                        if (c > 0 && grid[r][c-1] <= 0.02) addRec(r, c-1, r+1);
                        if (c < C - 1 && grid[r][c+1] <= 0.02) addRec(r, c+1, r+1);
                    }
                    
                    for (const cell of comp) surfaceMap[cell.r][cell.c] = minH;

                    providers.sort((a,b) => a.h - b.h); 
                    receivers.sort((a,b) => b.h - a.h); 
                    
                    let pIdx = 0, rIdx = 0;
                    while (pIdx < providers.length && rIdx < receivers.length) {
                        const p = providers[pIdx];
                        const rec = receivers[rIdx];

                        if (rec.h - p.h > 0.05) { 
                            const available = grid[p.r][p.c];
                            const space = 1.0 - grid[rec.r][rec.c];
                            const diff = (rec.h - p.h) / 2;
                            const amt = Math.min(available, space, diff, 0.4);
                            
                            if (amt > 0.005) {
                                grid[p.r][p.c] -= amt;
                                grid[rec.r][rec.c] += amt;
                                p.h += amt;
                                rec.h -= amt;
                                if (grid[p.r][p.c] <= 0.01) pIdx++;
                                if (grid[rec.r][rec.c] >= 0.99) rIdx++;
                            } else { break; }
                        } else { break; }
                    }
                }
            }
        }
    }
    return surfaceMap;
}

function getPressureKPa(x: number, y: number, grid: Float32Array[], walls: boolean[][], gravity: number, isOpen: boolean, surfaceMap: Float32Array[]): number {
    const p0 = isOpen ? ATM_PRESSURE : 0;
    const c = Math.floor(Math.max(0, Math.min(GRID_COLS - 1, x)));
    const r = Math.floor(Math.max(0, Math.min(GRID_ROWS - 1, y)));
    
    if (walls[r][c] || grid[r][c] <= 0.01 || surfaceMap[r][c] === -1) return p0; 
    const depthMeters = Math.max(0, (y - surfaceMap[r][c]) * METERS_PER_CELL);
    return p0 + (WATER_DENSITY * gravity * depthMeters) / 1000;
}

function createInitialWallGrid(): boolean[][] {
    const grid: boolean[][] = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(false));
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (c === 0 || c === GRID_COLS - 1 || r === GRID_ROWS - 1) grid[r][c] = true;
        }
    }
    for (let r = 0; r < GRID_ROWS - 1; r++) grid[r][15] = true;
    return grid;
}

export default function HydrostaticPressure() {
    const [simState, setSimState] = useState<SimState>(() => ({ wallGrid: createInitialWallGrid() }));
    const waterGridRef = useRef<Float32Array[]>(Array.from({length: GRID_ROWS}, () => new Float32Array(GRID_COLS)));
    
    useEffect(() => {
        let initialized = false;
        for (let r=0; r<GRID_ROWS; r++) for (let c=0; c<GRID_COLS; c++) if (waterGridRef.current[r][c] > 0) initialized = true;
        if (!initialized) {
            for (let c = 1; c < GRID_COLS - 1; c++) {
                if (c === 15) continue;
                for (let r = 8; r < GRID_ROWS - 1; r++) {
                    waterGridRef.current[r][c] = 1.0;
                }
            }
        }
    }, [simState.wallGrid]);

    const surfaceMapRef = useRef<Float32Array[]>(Array.from({length: GRID_ROWS}, () => new Float32Array(GRID_COLS).fill(-1)));
    const [gravity, setGravity] = useState(9.81);
    const [isOpenAtmosphere, setIsOpenAtmosphere] = useState(true);
    const [toolMode, setToolMode] = useState<ToolMode>('draw');
    const [showPressureField, setShowPressureField] = useState(false);
    const [showWallForces, setShowWallForces] = useState(true);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const lastCellRef = useRef<{ r: number; c: number } | null>(null);

    const stateRef = useRef({ wallGrid: simState.wallGrid, gravity, isOpenAtmosphere, showPressureField, showWallForces });
    useEffect(() => {
        stateRef.current = { wallGrid: simState.wallGrid, gravity, isOpenAtmosphere, showPressureField, showWallForces };
    }, [simState.wallGrid, gravity, isOpenAtmosphere, showPressureField, showWallForces]);

    const [wallForceSummary, setWallForceSummary] = useState({ count: 0, total: 0, max: 0 });

    const applyTool = useCallback((r: number, c: number) => {
        if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return;

        if (toolMode === 'addWater') {
            if (!simState.wallGrid[r][c]) waterGridRef.current[r][c] = Math.min(1.0, waterGridRef.current[r][c] + 0.3);
            return;
        }
        if (toolMode === 'removeWater') {
            waterGridRef.current[r][c] = Math.max(0, waterGridRef.current[r][c] - 0.3);
            return;
        }

        setSimState((prev) => {
            if (toolMode === 'draw') {
                if (prev.wallGrid[r][c]) return prev;
                const newWall = prev.wallGrid.map(row => [...row]);
                newWall[r][c] = true;
                let displaced = waterGridRef.current[r][c];
                waterGridRef.current[r][c] = 0;
                let cr = r - 1;
                while (cr >= 0 && displaced > 0) {
                    if (!newWall[cr][c]) {
                        const space = 1.0 - waterGridRef.current[cr][c];
                        if (space > 0) {
                            const f = Math.min(space, displaced);
                            waterGridRef.current[cr][c] += f;
                            displaced -= f;
                        }
                    }
                    cr--;
                }
                return { wallGrid: newWall };
            }
            if (toolMode === 'erase') {
                if (!prev.wallGrid[r][c] || r === GRID_ROWS - 1 || c === 0 || c === GRID_COLS - 1) return prev;
                const newWall = prev.wallGrid.map(row => [...row]);
                newWall[r][c] = false;
                return { wallGrid: newWall };
            }
            return prev;
        });
    }, [toolMode, simState.wallGrid]);

    const bresenhamLine = useCallback((r0: number, c0: number, r1: number, c1: number) => {
        const cells: Array<{ r: number; c: number }> = [];
        const dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0);
        const sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
        let err = dc - dr;
        let cr = r0, cc = c0;
        while (true) {
            cells.push({ r: cr, c: cc });
            if (cr === r1 && cc === c1) break;
            const e2 = 2 * err;
            if (e2 > -dr) { err -= dr; cc += sc; }
            if (e2 < dc) { err += dc; cr += sr; }
        }
        return cells;
    }, []);

    const getGridCoords = useCallback((e: React.MouseEvent | React.TouchEvent | PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0, r: 0, c: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as any).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as any).clientY;
        const px = clientX - rect.left;
        const py = clientY - rect.top;
        const cellW = canvas.width / GRID_COLS;
        const cellH = canvas.height / GRID_ROWS;
        return { x: px / cellW, y: py / cellH, c: Math.floor(px / cellW), r: Math.floor(py / cellH) };
    }, []);

    const handlePointerDown = (e: React.PointerEvent) => {
        const { r, c } = getGridCoords(e);
        lastCellRef.current = { r, c };
        isDrawingRef.current = true;
        applyTool(r, c);
        try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch(ex){}
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawingRef.current) return;
        const { r, c } = getGridCoords(e);
        const prev = lastCellRef.current;
        if (prev && (prev.r !== r || prev.c !== c)) {
            bresenhamLine(prev.r, prev.c, r, c).forEach(({ r: cr, c: cc }) => applyTool(cr, cc));
        } else {
            applyTool(r, c);
        }
        lastCellRef.current = { r, c };
    };

    const handlePointerUp = (e: React.PointerEvent) => { 
        isDrawingRef.current = false; 
        lastCellRef.current = null; 
        try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch(ex){}
    };

    // --- Render Loop ---
    useEffect(() => {
        let animationId = 0;
        let frameCount = 0;

        const renderLoop = () => {
            frameCount++;
            const { wallGrid, gravity, showPressureField, showWallForces, isOpenAtmosphere } = stateRef.current;
            const grid = waterGridRef.current;

            surfaceMapRef.current = updateSurfacesAndTick(grid, wallGrid);
            const surfaceMap = surfaceMapRef.current;

            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) return (animationId = requestAnimationFrame(renderLoop));
            
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) return;

            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) { 
                canvas.width = rect.width * dpr; 
                canvas.height = rect.height * dpr; 
                ctx.scale(dpr, dpr);
            }

            const w = rect.width, h = rect.height;
            const cellW = w / GRID_COLS, cellH = h / GRID_ROWS;
            
            // Industrial background
            ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, w, h);

            // Tech Grid
            ctx.strokeStyle = 'rgba(0, 230, 255, 0.05)'; 
            ctx.lineWidth = 1; 
            ctx.beginPath();
            for (let r = 0; r <= GRID_ROWS; r++) { ctx.moveTo(0, r * cellH); ctx.lineTo(w, r * cellH); }
            for (let c = 0; c <= GRID_COLS; c++) { ctx.moveTo(c * cellW, 0); ctx.lineTo(c * cellW, h); }
            ctx.stroke();

            // Render Fluids
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    if (wallGrid[r][c]) continue;
                    const m = grid[r][c];
                    if (m <= 0.05) continue;
                    
                    let fill = m;
                    if (r > 0 && !wallGrid[r-1][c] && grid[r-1][c] > 0.05) fill = 1.0;
                    
                    if (showPressureField) {
                        const surface = surfaceMap[r][c] !== -1 ? surfaceMap[r][c] : (r + 1 - m);
                        const depth = Math.max(0, (r + 0.5) - surface);
                        const hue = Math.max(180, 280 - (depth / 15) * 100);
                        ctx.fillStyle = `hsla(${hue}, 100%, 55%, ${0.6 + fill * 0.4})`;
                    } else {
                        const surface = surfaceMap[r][c] !== -1 ? surfaceMap[r][c] : (r + 1 - m);
                        const depth = Math.max(0, (r + 0.5) - surface);
                        const norm = Math.min(1, Math.max(0, depth / 15));
                        ctx.fillStyle = WATER_COLOR;
                        ctx.globalAlpha = 0.5 + norm * 0.5;
                    }
                    
                    const cellHFill = cellH * fill;
                    const y = r * cellH + (cellH - cellHFill);
                    ctx.fillRect(c * cellW, y, cellW + 0.5, cellHFill + 0.5);
                    ctx.globalAlpha = 1;
                    
                    // Surface glowing line
                    if (r === 0 || wallGrid[r-1][c] || grid[r-1][c] <= 0.05) {
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                        ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.moveTo(c * cellW, y); ctx.lineTo((c + 1) * cellW, y); ctx.stroke();
                        ctx.shadowColor = 'rgba(0, 230, 255, 0.8)'; ctx.shadowBlur = 5;
                        ctx.stroke(); ctx.shadowBlur = 0;
                    }
                }
            }

            let forceTotalX = 0, forceTotalY = 0, forceMax = 0, forceCount = 0;

            // Draw Walls (Brutalist metal)
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    if (wallGrid[r][c]) {
                        ctx.fillStyle = '#1e293b'; ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
                        
                        // Diagonal hashing for walls
                        ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.moveTo(c * cellW, r * cellH + cellH); ctx.lineTo(c * cellW + cellW, r * cellH); ctx.stroke();

                        ctx.strokeStyle = '#334155'; ctx.strokeRect(c * cellW + 1.5, r * cellH + 1.5, cellW - 3, cellH - 3);
                        
                        // Render Force Vectors (Pushing INTO the wall)
                        if (showWallForces) {
                            for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                                const nr = r + dr, nc = c + dc;
                                if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS || wallGrid[nr][nc]) continue;
                                const p = getPressureKPa(nc + 0.5, nr + 0.5, grid, wallGrid, gravity, isOpenAtmosphere, surfaceMap) - (isOpenAtmosphere ? ATM_PRESSURE : 0);
                                if (p <= 0.01) continue;

                                const magnitude = p * WALL_FACE_AREA * 1000;
                                forceCount++; forceTotalX -= dc * magnitude; forceTotalY -= dr * magnitude; forceMax = Math.max(forceMax, magnitude);
                                
                                const maxScaleP = 60;
                                const len = cellW * (0.2 + 0.8 * Math.min(1, p / maxScaleP));
                                
                                // Vector points from water INTO the wall
                                const vx = -dc; 
                                const vy = -dr;
                                
                                // Origin starts somewhat back in the water
                                const x1 = (nc + 0.5 - vx * 0.15) * cellW;
                                const y1 = (nr + 0.5 - vy * 0.15) * cellH;
                                const x2 = x1 + vx * len;
                                const y2 = y1 + vy * len;
                                const head = Math.min(7, len * 0.4);
                                
                                ctx.strokeStyle = ctx.fillStyle = '#f97316'; // Amber neon vector
                                ctx.lineWidth = 1.5;
                                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
                                ctx.beginPath(); ctx.moveTo(x2, y2); 
                                ctx.lineTo(x2 - vx * head - vy * head * 0.5, y2 - vy * head + vx * head * 0.5); 
                                ctx.lineTo(x2 - vx * head + vy * head * 0.5, y2 - vy * head - vx * head * 0.5); 
                                ctx.fill();
                            }
                        }
                    }
                }
            }

            if (frameCount % 15 === 0) setWallForceSummary({ count: forceCount, total: Math.sqrt(forceTotalX*forceTotalX + forceTotalY*forceTotalY), max: forceMax });
            animationId = requestAnimationFrame(renderLoop);
        };
        animationId = requestAnimationFrame(renderLoop);
        return () => cancelAnimationFrame(animationId);
    }, []);

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] w-full bg-[#050508] text-slate-200 overflow-hidden font-sans">
            
            {/* Canvas Area (Order 2 on mobile, 1 on desktop) */}
            <div className="flex-1 relative w-full h-full order-1 md:order-1 min-h-[50vh]">
                <div 
                    ref={containerRef} 
                    className={cn('absolute inset-0 w-full h-full touch-none', toolMode === 'draw' ? 'cursor-crosshair' : 'cursor-cell')} 
                    onPointerDown={handlePointerDown} 
                    onPointerMove={handlePointerMove} 
                    onPointerUp={handlePointerUp} 
                    onPointerCancel={handlePointerUp}
                >
                    <canvas ref={canvasRef} className="block w-full h-full" />
                </div>
            </div>

            {/* Sidebar / Bottom Panel */}
            <div className="w-full md:w-[320px] bg-slate-900 border-t md:border-t-0 md:border-l border-white/5 flex flex-col order-2 md:order-2 z-10 shadow-[-8px_0_30px_rgba(0,0,0,0.5)] md:h-full max-h-[50vh] md:max-h-full overflow-y-auto custom-scrollbar shrink-0">
                <div className="p-4 border-b border-white/5 top-0 sticky bg-slate-900 z-10 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-bold uppercase tracking-wider text-white">Centro de Control</h3>
                </div>

                <div className="p-4 flex flex-col gap-6 flex-1">
                    
                    {/* Visualización y Mediciones */}
                    <div>
                        <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3">Física y Visualización</h4>
                        <div className="flex flex-col gap-2">
                            <button onClick={() => setShowPressureField(v => !v)} className={cn('p-3 rounded-lg border flex items-center justify-between transition-all', showPressureField ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'bg-slate-950 border-white/5 text-slate-400 hover:bg-slate-800')}>
                                <span className="text-[11px] uppercase font-bold tracking-widest flex items-center gap-2"><Layers size={14}/> Campo de Presiones</span>
                                <div className={cn("w-2 h-2 rounded-full", showPressureField ? "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" : "bg-slate-600")} />
                            </button>
                            <button onClick={() => setShowWallForces(v => !v)} className={cn('p-3 rounded-lg border flex items-center justify-between transition-all', showWallForces ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-slate-950 border-white/5 text-slate-400 hover:bg-slate-800')}>
                                <span className="text-[11px] uppercase font-bold tracking-widest flex items-center gap-2"><Target size={14}/> Fuerzas en Muros</span>
                                <div className={cn("w-2 h-2 rounded-full", showWallForces ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" : "bg-slate-600")} />
                            </button>
                            
                            <button onClick={() => setIsOpenAtmosphere((v) => !v)} className={cn('p-3 rounded-lg border flex items-center justify-between transition-all mt-1.5', isOpenAtmosphere ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-slate-950/80 border-rose-500/30 text-rose-400')}>
                                <span className="text-[11px] uppercase font-bold tracking-widest">{isOpenAtmosphere ? 'Atmósfera Abierta' : 'Tanque Sellado (0 ATM)'}</span>
                                {isOpenAtmosphere ? <Download size={14} className="animate-pulse" /> : <X size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Gravedad */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                             <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Gravedad (Planetas)</h4>
                             <span className="font-mono text-cyan-400 text-[11px] px-2 py-0.5 bg-slate-950 rounded border border-cyan-500/30 font-bold">{gravity.toFixed(2)} m/s²</span>
                        </div>
                        <input type="range" min={GRAVITY_MIN} max={GRAVITY_MAX} step={0.01} value={gravity} onChange={(e) => setGravity(Number(e.target.value))} className="w-full accent-cyan-500 mb-3" />
                        
                        {/* Selector de Planetas */}
                        <div className="grid grid-cols-4 gap-1.5">
                            {GRAVITY_REFS.map(ref => (
                                <button key={ref.name} onClick={() => setGravity(ref.g)} className={cn("py-2 rounded text-[10px] uppercase font-bold border transition-colors", Math.abs(gravity - ref.g) < 0.1 ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'bg-slate-950 border-white/10 text-slate-500 hover:text-white hover:border-white/20')}>
                                    {ref.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Herramientas de Edición */}
                    <div>
                        <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3">Constructor Físico</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setToolMode('draw')} className={cn('p-2.5 rounded-lg border flex flex-col items-center gap-2 transition-all', toolMode === 'draw' ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'bg-slate-950/50 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white')}>
                                <PenTool size={18} /><span className="text-[10px] uppercase font-bold tracking-widest">Muro</span>
                            </button>
                            <button onClick={() => setToolMode('erase')} className={cn('p-2.5 rounded-lg border flex flex-col items-center gap-2 transition-all', toolMode === 'erase' ? 'bg-rose-500/20 border-rose-500/50 text-rose-300' : 'bg-slate-950/50 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white')}>
                                <Eraser size={18} /><span className="text-[10px] uppercase font-bold tracking-widest">Borrar</span>
                            </button>
                            <button onClick={() => setToolMode('addWater')} className={cn('p-2.5 rounded-lg border flex flex-col items-center gap-2 transition-all', toolMode === 'addWater' ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-slate-950/50 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white')}>
                                <Droplets size={18} /><span className="text-[10px] uppercase font-bold tracking-widest">Inyectar</span>
                            </button>
                            <button onClick={() => setToolMode('removeWater')} className={cn('p-2.5 rounded-lg border flex flex-col items-center gap-2 transition-all', toolMode === 'removeWater' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-slate-950/50 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white')}>
                                <X size={18} /><span className="text-[10px] uppercase font-bold tracking-widest">Drenar</span>
                            </button>
                        </div>
                    </div>

                    <div className="mt-auto mb-2 pt-4 border-t border-white/5">
                        <div className="mb-4 bg-slate-950 p-3 rounded-lg border border-white/5 space-y-1.5 relative overflow-hidden">
                            <div className="absolute inset-0 bg-amber-500/5 pattern-diagonal-lines pattern-amber-500 pattern-bg-transparent pattern-size-4 pattern-opacity-10"></div>
                            <div className="relative">
                                <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400"><span>Carga Total Externa</span><span className="font-mono text-amber-400">{(wallForceSummary.total / 1000).toFixed(1)} kN</span></div>
                                <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500"><span>Vectores de Estrés</span><span className="font-mono">{wallForceSummary.count}</span></div>
                            </div>
                        </div>

                        <button onClick={() => setSimState({wallGrid: createInitialWallGrid()})} className="w-full py-3 rounded-lg text-[11px] font-bold uppercase tracking-widest border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition-colors flex justify-center items-center gap-2"><Trash2 size={16}/> Purgar Entorno</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
