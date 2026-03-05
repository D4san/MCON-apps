import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MousePointer2, Eraser, PenTool, Layers, Settings, X, ChevronDown, ChevronUp, Plus, Minus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useIsPortrait } from '../../hooks/useIsPortrait';

// --- Constants ---
const GRID_COLS = 30;
const GRID_ROWS = 20;
const DEFAULT_FLUID_SURFACE = 5;
const METERS_PER_CELL = 0.5;
const PLANE_DEPTH_METERS = 1;
const WALL_FACE_AREA = METERS_PER_CELL * PLANE_DEPTH_METERS;
const ATM_PRESSURE = 101.325; // kPa
const WATER_DENSITY = 1000;
const WATER_COLOR = 'rgba(56, 189, 248, 0.65)';

const GRAVITY_REFS = [
    { name: 'Luna', g: 1.62 },
    { name: 'Marte', g: 3.72 },
    { name: 'Tierra', g: 9.81 },
    { name: 'Júpiter', g: 24.79 },
];
const GRAVITY_MIN = 0.5;
const GRAVITY_MAX = 28;

// --- Types ---
type ToolMode = 'draw' | 'erase' | 'sensor' | 'addWater' | 'removeWater';
interface Sensor { id: string; x: number; y: number; color: string; }
interface SimState { wallGrid: boolean[][]; }

// --- Column Physics Logic ---
function getColumnSurface(c: number, vol: number, wallGrid: boolean[][]): number {
    let rem = vol;
    for (let r = GRID_ROWS - 1; r >= 0; r--) {
        if (!wallGrid[r][c]) {
            if (rem <= 0) return r + 1;
            if (rem < 1) return r + 1 - rem;
            rem -= 1;
        }
    }
    return -rem; 
}

function getColumnDepthAt(x: number, y: number, waterVols: Float32Array, wallGrid: boolean[][]): number {
    const c = Math.floor(Math.max(0, Math.min(GRID_COLS - 1, x)));
    const s = getColumnSurface(c, waterVols[c], wallGrid);
    if (y > s && !wallGrid[Math.floor(y)][c]) return (y - s) * METERS_PER_CELL;
    return 0;
}

function getPressureKPa(x: number, y: number, waterVols: Float32Array, wallGrid: boolean[][], gravity: number, isOpen: boolean): number {
    const p0 = isOpen ? ATM_PRESSURE : 0;
    return p0 + (WATER_DENSITY * gravity * getColumnDepthAt(x, y, waterVols, wallGrid)) / 1000;
}

// Tick simulation -> The physical engine that runs correctly!
function tickFluid(waterVols: Float32Array, wallGrid: boolean[][]) {
    const C = GRID_COLS, R = GRID_ROWS;
    const surfaces = new Float32Array(C);
    for(let c=0; c<C; c++) surfaces[c] = getColumnSurface(c, waterVols[c], wallGrid);

    const newVols = new Float32Array(waterVols);
    const maxFlow = 1.5; 

    for (let pass = 0; pass < 2; pass++) {
        for (let baseC = 0; pass === 0 ? baseC < C - 1 : baseC > 0; pass === 0 ? baseC++ : baseC--) {
            const c1 = pass === 0 ? baseC : baseC - 1;
            const c2 = c1 + 1;

            const s1 = surfaces[c1];
            const s2 = surfaces[c2];
            
            if (Math.abs(s1 - s2) > 0.005) {
                const sourceC = s1 < s2 ? c1 : c2;
                const destC = s1 < s2 ? c2 : c1;
                const sSource = s1 < s2 ? s1 : s2;
                const sDest = s1 < s2 ? s2 : s1;
                
                let connected = false;
                for(let r = R - 1; r >= 0; r--) {
                    if (!wallGrid[r][c1] && !wallGrid[r][c2]) {
                        if (sSource <= r + 1.01) { connected = true; break; }
                    }
                }

                if (connected) {
                    let flow = (sDest - sSource) * 0.45;
                    flow = Math.min(flow, newVols[sourceC]);
                    flow = Math.min(flow, maxFlow);
                    
                    if (flow > 0) {
                        newVols[sourceC] -= flow;
                        newVols[destC] += flow;
                        surfaces[sourceC] = getColumnSurface(sourceC, newVols[sourceC], wallGrid);
                        surfaces[destC] = getColumnSurface(destC, newVols[destC], wallGrid);
                    }
                }
            }
        }
    }
    for(let c=0; c<C; c++) waterVols[c] = newVols[c];
}

// Initial state
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

function computeCapacity(c: number, wallGrid: boolean[][]): number {
    let cap = 0;
    for (let r = 0; r < GRID_ROWS; r++) if (!wallGrid[r][c]) cap++;
    return cap;
}

export default function HydrostaticPressure() {
    const [simState, setSimState] = useState<SimState>(() => ({ wallGrid: createInitialWallGrid() }));
    const waterVolsRef = useRef<Float32Array>(new Float32Array(GRID_COLS));
    
    useEffect(() => {
        let initialized = false;
        for (let c=0; c<GRID_COLS; c++) if (waterVolsRef.current[c] > 0) initialized = true;
        if (!initialized) {
            for (let c = 1; c < GRID_COLS - 1; c++) {
                if (c === 15) continue;
                let cap = 0;
                for (let r = DEFAULT_FLUID_SURFACE; r < GRID_ROWS; r++) if (!simState.wallGrid[r][c]) cap++;
                waterVolsRef.current[c] = cap;
            }
        }
    }, [simState.wallGrid]);

    const [gravity, setGravity] = useState(9.81);
    const [isOpenAtmosphere, setIsOpenAtmosphere] = useState(true);
    const [toolMode, setToolMode] = useState<ToolMode>('sensor');
    const [showPressureField, setShowPressureField] = useState(false);
    const [showWallForces, setShowWallForces] = useState(true);
    const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(false);

    const [sensors, setSensors] = useState<Sensor[]>([
        { id: 's1', x: 5, y: 15, color: '#ef4444' },
        { id: 's2', x: 25, y: 15, color: '#22c55e' },
    ]);
    const [activeSensorId, setActiveSensorId] = useState<string | null>(null);

    const isPortrait = useIsPortrait();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const lastCellRef = useRef<{ r: number; c: number } | null>(null);
    const lastWaterCellRef = useRef<string | null>(null);

    const stateRef = useRef({ wallGrid: simState.wallGrid, gravity, isOpenAtmosphere, showPressureField, showWallForces });
    useEffect(() => {
        stateRef.current = { wallGrid: simState.wallGrid, gravity, isOpenAtmosphere, showPressureField, showWallForces };
    }, [simState.wallGrid, gravity, isOpenAtmosphere, showPressureField, showWallForces]);

    const [wallForceSummary, setWallForceSummary] = useState({ count: 0, total: 0, max: 0 });

    const getPressureAt = useCallback(
        (x: number, y: number) => getPressureKPa(x, y, waterVolsRef.current, simState.wallGrid, gravity, isOpenAtmosphere),
        [simState.wallGrid, gravity, isOpenAtmosphere]
    );

    const closestGravityRef = useMemo(() => {
        let closest = GRAVITY_REFS[0];
        let minDist = Math.abs(gravity - closest.g);
        for (const ref of GRAVITY_REFS) {
            const dist = Math.abs(gravity - ref.g);
            if (dist < minDist) { closest = ref; minDist = dist; }
        }
        return minDist < 0.3 ? closest : null;
    }, [gravity]);

    const applyTool = useCallback((r: number, c: number) => {
        if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return;

        if (toolMode === 'addWater' || toolMode === 'removeWater') {
            const key = `${r},${c}`;
            if (lastWaterCellRef.current === key) return;
            lastWaterCellRef.current = key;
        }

        if (toolMode === 'addWater') {
            const cap = computeCapacity(c, simState.wallGrid);
            waterVolsRef.current[c] = Math.min(cap, waterVolsRef.current[c] + 4.0);
            return;
        }
        if (toolMode === 'removeWater') {
            waterVolsRef.current[c] = Math.max(0, waterVolsRef.current[c] - 4.0);
            return;
        }

        setSimState((prev) => {
            if (toolMode === 'draw') {
                if (prev.wallGrid[r][c]) return prev;
                const newWall = prev.wallGrid.map(row => [...row]);
                newWall[r][c] = true;
                waterVolsRef.current[c] = Math.max(0, waterVolsRef.current[c] - 1);
                return { wallGrid: newWall };
            }
            if (toolMode === 'erase') {
                if (!prev.wallGrid[r][c]) return prev;
                if (r === GRID_ROWS - 1 || c === 0 || c === GRID_COLS - 1) return prev;
                const newWall = prev.wallGrid.map(row => [...row]);
                newWall[r][c] = false;
                return { wallGrid: newWall };
            }
            return prev;
        });
    }, [toolMode, simState.wallGrid]);

    const bresenhamLine = useCallback((r0: number, c0: number, r1: number, c1: number) => {
        const cells: Array<{ r: number; c: number }> = [];
        const dr = Math.abs(r1 - r0);
        const dc = Math.abs(c1 - c0);
        const sr = r0 < r1 ? 1 : -1;
        const sc = c0 < c1 ? 1 : -1;
        let err = dc - dr;
        let cr = r0;
        let cc = c0;
        while (true) {
            cells.push({ r: cr, c: cc });
            if (cr === r1 && cc === c1) break;
            const e2 = 2 * err;
            if (e2 > -dr) { err -= dr; cc += sc; }
            if (e2 < dc) { err += dc; cr += sr; }
        }
        return cells;
    }, []);

    const getGridCoords = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0, r: 0, c: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const px = clientX - rect.left;
        const py = clientY - rect.top;
        const cellW = canvas.width / GRID_COLS;
        const cellH = canvas.height / GRID_ROWS;
        return { x: px / cellW, y: py / cellH, c: Math.floor(px / cellW), r: Math.floor(py / cellH) };
    }, []);

    const handleClearAll = useCallback(() => {
        const wg = createInitialWallGrid();
        for(let c=1; c<GRID_COLS-1; c++) {
            waterVolsRef.current[c] = 0;
            for(let r=1; r<GRID_ROWS-1; r++) wg[r][c] = false;
        }
        setSimState({ wallGrid: wg });
    }, []);

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        const { x, y, r, c } = getGridCoords(e);
        lastCellRef.current = { r, c };
        lastWaterCellRef.current = null;

        if (toolMode === 'sensor') {
            const clicked = sensors.find((s) => Math.hypot(s.x - x, s.y - y) < 1.5);
            if (clicked) { setActiveSensorId(clicked.id); isDrawingRef.current = true; }
            return;
        }
        isDrawingRef.current = true;
        applyTool(r, c);
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current) return;
        const { x, y, r, c } = getGridCoords(e);
        
        if (toolMode === 'sensor' && activeSensorId) {
            setSensors((prev) => prev.map((s) => s.id === activeSensorId ? { ...s, x: Math.max(0.5, Math.min(GRID_COLS - 0.5, x)), y: Math.max(0.5, Math.min(GRID_ROWS - 0.5, y)) } : s));
            return;
        }

        const prev = lastCellRef.current;
        if (prev && (prev.r !== r || prev.c !== c)) {
            bresenhamLine(prev.r, prev.c, r, c).forEach(({ r: cr, c: cc }) => applyTool(cr, cc));
        } else {
            applyTool(r, c);
        }
        lastCellRef.current = { r, c };
    };

    const handlePointerUp = () => { isDrawingRef.current = false; setActiveSensorId(null); lastCellRef.current = null; lastWaterCellRef.current = null; };

    // --- Render Loop ---
    useEffect(() => {
        let animationId = 0;
        let frameCount = 0;

        const renderLoop = () => {
            frameCount++;
            const { wallGrid, gravity, showPressureField, showWallForces, isOpenAtmosphere } = stateRef.current;
            const waterVols = waterVolsRef.current;

            for(let i=0; i<6; i++) tickFluid(waterVols, wallGrid);

            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) return (animationId = requestAnimationFrame(renderLoop));
            
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) return;

            const rect = container.getBoundingClientRect();
            if (canvas.width !== rect.width || canvas.height !== rect.height) { canvas.width = rect.width; canvas.height = rect.height; }

            const cellW = canvas.width / GRID_COLS, cellH = canvas.height / GRID_ROWS;
            
            ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'; ctx.lineWidth = 1; ctx.beginPath();
            for (let r = 0; r <= GRID_ROWS; r++) { ctx.moveTo(0, r * cellH); ctx.lineTo(canvas.width, r * cellH); }
            for (let c = 0; c <= GRID_COLS; c++) { ctx.moveTo(c * cellW, 0); ctx.lineTo(c * cellW, canvas.height); }
            ctx.stroke();

            for (let c = 0; c < GRID_COLS; c++) {
                if (waterVols[c] <= 0.001) continue;
                let fluidLeft = waterVols[c];
                
                for (let r = GRID_ROWS - 1; r >= 0 && fluidLeft > 0.001; r--) {
                    if (wallGrid[r][c]) continue;
                    
                    const fillAmount = Math.min(1.0, fluidLeft);
                    
                    if (showPressureField) {
                        const surface = getColumnSurface(c, waterVols[c], wallGrid);
                        const depth = (r + 1 - surface) * METERS_PER_CELL;
                        const hue = Math.max(0, 220 - (depth / 10) * 220);
                        ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${0.5 + fillAmount * 0.4})`;
                    } else {
                        const surface = getColumnSurface(c, waterVols[c], wallGrid);
                        const depth = (r + 1 - surface) * METERS_PER_CELL;
                        const norm = Math.min(1, Math.max(0, depth / 10));
                        ctx.fillStyle = WATER_COLOR;
                        ctx.globalAlpha = 0.6 + norm * 0.4;
                    }
                    
                    const h = cellH * fillAmount;
                    const y = r * cellH + (cellH - h);
                    
                    ctx.fillRect(c * cellW, y, cellW + 0.5, h + 0.5);
                    ctx.globalAlpha = 1;
                    
                    if (fluidLeft <= 1.0) {
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.moveTo(c * cellW, y); ctx.lineTo((c + 1) * cellW, y); ctx.stroke(); ctx.setLineDash([]);
                    }
                    fluidLeft -= fillAmount;
                }
            }

            let forceTotalX = 0, forceTotalY = 0, forceMax = 0, forceCount = 0;
            ctx.fillStyle = '#334155'; ctx.strokeStyle = '#475569';
            
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    if (wallGrid[r][c]) {
                        ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
                        ctx.strokeRect(c * cellW + 1.5, r * cellH + 1.5, cellW - 3, cellH - 3);
                        
                        if (showWallForces) {
                            for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                                const nr = r + dr, nc = c + dc;
                                if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS || wallGrid[nr][nc]) continue;
                                const p = getPressureKPa(nc + 0.5, nr + 0.5, waterVols, wallGrid, gravity, isOpenAtmosphere) - (isOpenAtmosphere ? ATM_PRESSURE : 0);
                                if (p <= 0.01) continue;
                                const magnitude = p * WALL_FACE_AREA * 1000;
                                forceCount++; forceTotalX -= dc * magnitude; forceTotalY -= dr * magnitude; forceMax = Math.max(forceMax, magnitude);
                                
                                const len = cellW * (0.2 + 0.65 * Math.min(1, p / 60));
                                const x1 = (nc + 0.5 - dc * 0.15) * cellW, y1 = (nr + 0.5 - dr * 0.15) * cellH;
                                const x2 = x1 + dc * len, y2 = y1 + dr * len;
                                const ux = dc, uy = dr;
                                const head = Math.min(7, len * 0.4);
                                ctx.strokeStyle = ctx.fillStyle = 'rgba(251, 146, 60, 0.9)'; ctx.lineWidth = 1.5;
                                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
                                ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - ux * head - uy * head * 0.5, y2 - uy * head + ux * head * 0.5); ctx.lineTo(x2 - ux * head + uy * head * 0.5, y2 - uy * head - ux * head * 0.5); ctx.fill();
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

    const controls = (
        <>
            <div className="space-y-1.5">
                <div className="flex gap-1.5 justify-center bg-slate-950/50 p-1.5 rounded-xl border border-white/5">
                    <button onClick={() => setToolMode('sensor')} className={cn('p-2.5 rounded-lg transition-colors flex-1 flex flex-col items-center gap-0.5', toolMode === 'sensor' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white')}><MousePointer2 className="w-4 h-4" /><span className="text-[8px] leading-none">Mover</span></button>
                    <button onClick={() => setToolMode('draw')} className={cn('p-2.5 rounded-lg transition-colors flex-1 flex flex-col items-center gap-0.5', toolMode === 'draw' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white')}><PenTool className="w-4 h-4" /><span className="text-[8px] leading-none">Pared</span></button>
                    <button onClick={() => setToolMode('erase')} className={cn('p-2.5 rounded-lg transition-colors flex-1 flex flex-col items-center gap-0.5', toolMode === 'erase' ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-white')}><Eraser className="w-4 h-4" /><span className="text-[8px] leading-none">Borrar</span></button>
                </div>
                <div className="flex gap-1.5 justify-center bg-slate-950/50 p-1.5 rounded-xl border border-white/5">
                    <button onClick={() => setToolMode('addWater')} className={cn('p-2.5 rounded-lg transition-colors flex-1 flex flex-col items-center gap-0.5', toolMode === 'addWater' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-white')}><Plus className="w-4 h-4" /><span className="text-[8px] leading-none">Agua</span></button>
                    <button onClick={() => setToolMode('removeWater')} className={cn('p-2.5 rounded-lg transition-colors flex-1 flex flex-col items-center gap-0.5', toolMode === 'removeWater' ? 'bg-sky-500/20 text-sky-200' : 'text-slate-400 hover:text-white')}><Minus className="w-4 h-4" /><span className="text-[8px] leading-none">Quitar</span></button>
                    <button onClick={() => setShowPressureField((v) => !v)} className={cn('p-2.5 rounded-lg transition-colors flex-1 flex flex-col items-center gap-0.5', showPressureField ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400 hover:text-white')}><Layers className="w-4 h-4" /><span className="text-[8px] leading-none">Presión</span></button>
                </div>
                <button onClick={handleClearAll} className="w-full p-2 rounded-lg transition-colors bg-slate-950/50 border border-white/5 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /><span className="text-[9px] leading-none font-medium">Limpiar paredes</span></button>
            </div>
            <div className="space-y-3">
                <div className="space-y-2 rounded-lg border border-white/10 bg-slate-950/40 p-3">
                    <div className="flex items-center justify-between text-[11px] font-semibold tracking-wide text-slate-300">
                        <span>Gravedad</span><span className="font-mono text-cyan-300">{gravity.toFixed(2)} m/s²{closestGravityRef && <span className="text-slate-500 ml-1">({closestGravityRef.name})</span>}</span>
                    </div>
                    <input type="range" min={GRAVITY_MIN} max={GRAVITY_MAX} step={0.01} value={gravity} onChange={(e) => setGravity(Number(e.target.value))} className="w-full accent-cyan-400" />
                </div>
                <button onClick={() => setIsOpenAtmosphere((v) => !v)} className={cn('w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors', isOpenAtmosphere ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 'bg-slate-950/50 border-white/10 text-slate-400')}>
                    <span className="text-xs sm:text-sm font-medium">{isOpenAtmosphere ? 'Tanque abierto' : 'Tanque cerrado'}</span>
                    <div className={cn('w-8 h-4 rounded-full relative transition-[background-color]', isOpenAtmosphere ? 'bg-blue-500' : 'bg-slate-600')}><div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-[left]', isOpenAtmosphere ? 'left-4.5' : 'left-0.5')} /></div>
                </button>
                <div className="grid grid-cols-1 gap-2"><button onClick={() => setShowWallForces((v) => !v)} className={cn('w-full rounded-lg border px-3 py-2 text-xs font-medium transition-colors', showWallForces ? 'bg-amber-500/15 border-amber-500/30 text-amber-100' : 'bg-slate-950/50 border-white/10 text-slate-300 hover:text-white')}>{showWallForces ? 'Ocultar fuerzas' : 'Mostrar fuerzas'}</button></div>
            </div>
        </>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] w-full bg-slate-950 text-slate-200 overflow-hidden relative">
            <div className="flex-1 relative bg-slate-950 flex flex-col h-full w-full">
                <div className={cn('absolute z-20 bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-xl p-3 sm:p-4 shadow-2xl pointer-events-auto flex flex-col max-w-[250px]', 'top-4 left-4')}>
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Lecturas y fuerzas</h3>
                    <div className="flex flex-col gap-2 sm:gap-3">
                        {sensors.map((sensor) => (
                            <div key={sensor.id} className="flex items-center gap-2 sm:gap-3">
                                <div className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]" style={{ backgroundColor: sensor.color, boxShadow: `0 0 10px ${sensor.color}80` }} />
                                <div className="flex flex-col font-mono"><span className="text-base sm:text-lg font-bold text-white tracking-tight leading-none">{getPressureAt(sensor.x, sensor.y).toFixed(1)}</span><span className="text-[10px] text-slate-400 font-sans mt-0.5">kPa</span></div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 border-t border-white/10 pt-2 space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-300"><span>Fuerza total</span><span className="font-mono text-amber-200">{(wallForceSummary.total / 1000).toFixed(1)} kN</span></div>
                        <div className="flex justify-between text-[11px] text-slate-400"><span>Contactos</span><span className="font-mono">{wallForceSummary.count}</span></div>
                    </div>
                </div>

                {isPortrait && <button onClick={() => setIsMobileMenuOpen(true)} className="absolute top-4 right-4 z-30 p-3 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl text-slate-300 hover:text-white transition-colors"><Settings className="w-5 h-5" /></button>}
                {isPortrait && isMobileMenuOpen && (
                    <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end pointer-events-auto">
                        <div className="bg-slate-900 border-t border-white/10 rounded-t-2xl p-4 flex flex-col gap-4 animate-in slide-in-from-bottom-full duration-300 max-h-[88vh] overflow-auto">
                            <div className="flex justify-between items-center mb-1"><h3 className="text-sm font-bold text-white uppercase tracking-widest">Herramientas</h3><button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button></div>
                            {controls}
                        </div>
                    </div>
                )}
                {!isPortrait && (
                    <div className="absolute top-4 right-4 z-20 w-72 bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden pointer-events-auto">
                        <button onClick={() => setIsPropertiesCollapsed((v) => !v)} className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors border-b border-white/5"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controles</span>{isPropertiesCollapsed ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}</button>
                        <div className={cn('p-4 transition-all duration-300', isPropertiesCollapsed ? 'hidden' : 'block')}>{controls}</div>
                    </div>
                )}

                <div ref={containerRef} className={cn('flex-1 w-full h-full relative', toolMode === 'draw' ? 'cursor-crosshair' : toolMode === 'erase' || toolMode === 'addWater' || toolMode === 'removeWater' ? 'cursor-cell' : 'cursor-default')} onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp} onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}>
                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none" />
                </div>
            </div>
        </div>
    );
}
