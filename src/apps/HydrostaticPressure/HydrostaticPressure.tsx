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

type ToolMode = 'draw' | 'erase' | 'sensor' | 'addWater' | 'removeWater';
interface Sensor { id: string; x: number; y: number; color: string; }
interface SimState { wallGrid: boolean[][]; }

// --- Hybrid Exact Topological Fluid Solver ---
// Resolves the exact hydrostatic pressure and level without fluctuation
function updateSurfacesAndTick(grid: Float32Array[], walls: boolean[][]): Float32Array[] {
    const R = GRID_ROWS, C = GRID_COLS;
    const surfaceMap = Array.from({length: R}, () => new Float32Array(C).fill(-1));
    
    // Multiple smooth passes per frame
    for (let pass = 0; pass < 3; pass++) {
        // 1. Gravity phase (Straight vertical drop only, ensuring mass falls smoothly)
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

        // 2. Hydrostatic Potential Equalization (U-tube & Leveling)
        const visited = Array.from({length: R}, () => new Array(C).fill(false));
        for (let startR = 0; startR < R; startR++) {
            for (let startC = 0; startC < C; startC++) {
                if (!visited[startR][startC] && grid[startR][startC] > 0.05 && !walls[startR][startC]) {
                    const comp: Array<{r: number, c: number}> = [];
                    const q = [{r: startR, c: startC}];
                    visited[startR][startC] = true;
                    
                    // BFS to find contiguous body of fluid
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
                        
                        // Internal partial fills
                        if (m < 0.98) addRec(r, c, h);
                        
                        // Adjacent air pockets (to spread horizontally & climb up tubes)
                        if (r > 0 && grid[r-1][c] <= 0.02) addRec(r-1, c, r);
                        if (c > 0 && grid[r][c-1] <= 0.02) addRec(r, c-1, r+1);
                        if (c < C - 1 && grid[r][c+1] <= 0.02) addRec(r, c+1, r+1);
                    }
                    
                    // Assign exact physical baseline for accurate pressure rendering everywhere in body
                    for (const cell of comp) surfaceMap[cell.r][cell.c] = minH;

                    // Execute teleporting leveling
                    providers.sort((a,b) => a.h - b.h); // High points (lowest absolute offset) first
                    receivers.sort((a,b) => b.h - a.h); // Low points (highest absolute offset) first
                    
                    let pIdx = 0, rIdx = 0;
                    while (pIdx < providers.length && rIdx < receivers.length) {
                        const p = providers[pIdx];
                        const rec = receivers[rIdx];

                        // Transfer if topologically significant slope exists (fixes jitter)
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
                            } else {
                                break;
                            }
                        } else {
                            break;
                        }
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
    
    if (walls[r][c] || grid[r][c] <= 0.01 || surfaceMap[r][c] === -1) {
        return p0; 
    }
    const depthMeters = Math.max(0, (y - surfaceMap[r][c]) * METERS_PER_CELL);
    return p0 + (WATER_DENSITY * gravity * depthMeters) / 1000;
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

export default function HydrostaticPressure() {
    const [simState, setSimState] = useState<SimState>(() => ({ wallGrid: createInitialWallGrid() }));
    
    // Explicit 2D fluid array avoiding react hooks entirely
    const waterGridRef = useRef<Float32Array[]>(Array.from({length: GRID_ROWS}, () => new Float32Array(GRID_COLS)));
    
    useEffect(() => {
        let initialized = false;
        for (let r=0; r<GRID_ROWS; r++) for (let c=0; c<GRID_COLS; c++) if (waterGridRef.current[r][c] > 0) initialized = true;
        if (!initialized) {
            for (let c = 1; c < GRID_COLS - 1; c++) {
                if (c === 15) continue; // divider
                for (let r = DEFAULT_FLUID_SURFACE; r < GRID_ROWS - 1; r++) {
                    waterGridRef.current[r][c] = 1.0;
                }
            }
        }
    }, [simState.wallGrid]);

    const surfaceMapRef = useRef<Float32Array[]>(Array.from({length: GRID_ROWS}, () => new Float32Array(GRID_COLS).fill(-1)));
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
        (x: number, y: number) => getPressureKPa(x, y, waterGridRef.current, simState.wallGrid, gravity, isOpenAtmosphere, surfaceMapRef.current),
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
            if (!simState.wallGrid[r][c]) {
                waterGridRef.current[r][c] = Math.min(1.0, waterGridRef.current[r][c] + 1.0);
            }
            return;
        }
        if (toolMode === 'removeWater') {
            waterGridRef.current[r][c] = 0;
            return;
        }

        setSimState((prev) => {
            if (toolMode === 'draw') {
                if (prev.wallGrid[r][c]) return prev;
                const newWall = prev.wallGrid.map(row => [...row]);
                newWall[r][c] = true;
                
                // push water upward perfectly when enclosed
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
        for(let r=0; r<GRID_ROWS; r++) {
            for(let c=1; c<GRID_COLS-1; c++) {
                if (r > 0 && r < GRID_ROWS - 1) {
                   wg[r][c] = false;
                }
                waterGridRef.current[r][c] = 0;
            }
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
            const grid = waterGridRef.current;

            // Step fluid physics & update surface map baseline automatically
            surfaceMapRef.current = updateSurfacesAndTick(grid, wallGrid);
            const surfaceMap = surfaceMapRef.current;

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

            // Render Fluids
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    if (wallGrid[r][c]) continue;
                    const m = grid[r][c];
                    if (m <= 0.05) continue;
                    
                    let fill = m;
                    // Connect vertically rendered blocks seamlessly
                    if (r > 0 && !wallGrid[r-1][c] && grid[r-1][c] > 0.05) fill = 1.0;
                    
                    if (showPressureField) {
                        const surface = surfaceMap[r][c] !== -1 ? surfaceMap[r][c] : (r + 1 - m);
                        const depth = Math.max(0, (r + 0.5) - surface);
                        const hue = Math.max(0, 220 - (depth / 10) * 220);
                        ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${0.5 + fill * 0.4})`;
                    } else {
                        const surface = surfaceMap[r][c] !== -1 ? surfaceMap[r][c] : (r + 1 - m);
                        const depth = Math.max(0, (r + 0.5) - surface);
                        const norm = Math.min(1, Math.max(0, depth / 10));
                        ctx.fillStyle = WATER_COLOR;
                        ctx.globalAlpha = 0.6 + norm * 0.4;
                    }
                    
                    const h = cellH * fill;
                    const y = r * cellH + (cellH - h);
                    ctx.fillRect(c * cellW, y, cellW + 0.5, h + 0.5);
                    ctx.globalAlpha = 1;
                    
                    // Surface highlight
                    if (r === 0 || wallGrid[r-1][c] || grid[r-1][c] <= 0.05) {
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
                        ctx.beginPath(); ctx.moveTo(c * cellW, y); ctx.lineTo((c + 1) * cellW, y); ctx.stroke(); ctx.setLineDash([]);
                    }
                }
            }

            let forceTotalX = 0, forceTotalY = 0, forceMax = 0, forceCount = 0;
            ctx.fillStyle = '#334155'; ctx.strokeStyle = '#475569';
            
            // Draw Walls & exact directional forces using topographical surface map guarantees
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    if (wallGrid[r][c]) {
                        ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
                        ctx.strokeRect(c * cellW + 1.5, r * cellH + 1.5, cellW - 3, cellH - 3);
                        
                        if (showWallForces) {
                            for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                                const nr = r + dr, nc = c + dc;
                                if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS || wallGrid[nr][nc]) continue;
                                
                                // Directly poll pressure from the adjacent water's perspective mathematically solving cavities
                                const p = getPressureKPa(nc + 0.5, nr + 0.5, grid, wallGrid, gravity, isOpenAtmosphere, surfaceMap) - (isOpenAtmosphere ? ATM_PRESSURE : 0);
                                if (p <= 0.01) continue;

                                const magnitude = p * WALL_FACE_AREA * 1000;
                                forceCount++; forceTotalX -= dc * magnitude; forceTotalY -= dr * magnitude; forceMax = Math.max(forceMax, magnitude);
                                
                                const maxScaleP = 60;
                                const len = cellW * (0.2 + 0.65 * Math.min(1, p / maxScaleP));
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
                <button onClick={handleClearAll} className="w-full p-2 rounded-lg transition-colors bg-slate-950/50 border border-white/5 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /><span className="text-[9px] leading-none font-medium">Limpiar escena</span></button>
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
