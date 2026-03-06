import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Eraser,
    PenTool,
    Layers,
    Droplets,
    Trash2,
    X,
    Target,
    Download,
    Menu,
    Play,
    Pause,
    RotateCcw,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// --- Constants ---
const GRID_COLS = 30;
const GRID_ROWS = 20;
const METERS_PER_CELL = 0.5;
const PLANE_DEPTH_METERS = 1;
const WALL_FACE_AREA = METERS_PER_CELL * PLANE_DEPTH_METERS;
const ATM_PRESSURE = 101.325; // kPa
const WATER_DENSITY = 1000;
const WATER_COLOR = 'rgba(0, 230, 255, 0.65)';
const GRAVITY_MIN = 0.5;
const GRAVITY_MAX = 28.0;
const PIVOT_SAMPLE_OFFSET = 0.65;
const PIVOT_CELL_MASS = 260;
const PIVOT_DAMPING = 2200;
const MAX_ANGULAR_SPEED = 2.3;
const MAX_PIVOT_ANGLE = Math.PI * 0.98;
const FORCE_VECTOR_SCALE_KPA = 60;

const GRAVITY_REFS = [
    { name: 'Luna', g: 1.62 },
    { name: 'Marte', g: 3.72 },
    { name: 'Tierra', g: 9.81 },
    { name: 'Júpiter', g: 24.79 },
];

const NEIGHBORS: Array<[number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
];

type ToolMode = 'draw' | 'erase' | 'addWater' | 'removeWater' | 'pivot';
type LineAxis = 'horizontal' | 'vertical';

interface Cell {
    r: number;
    c: number;
}

interface SimState {
    wallGrid: boolean[][];
}

interface PivotCandidate {
    axis: LineAxis;
    cells: Cell[];
}

interface PivotWall {
    axis: LineAxis;
    cells: Cell[];
    pivotCell: Cell;
    pivot: { x: number; y: number };
    localCenters: Array<{ dx: number; dy: number }>;
    angle: number;
    angularVelocity: number;
    lastTorque: number;
    lastPressureDelta: number;
}

interface PivotDiagnostics {
    torque: number;
    pressureDelta: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function isInBounds(r: number, c: number): boolean {
    return r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS;
}

function cloneWallGrid(grid: boolean[][]): boolean[][] {
    return grid.map((row) => [...row]);
}

function cellKey({ r, c }: Cell): string {
    return `${r}:${c}`;
}

function uniqueCells(cells: Cell[]): Cell[] {
    const seen = new Set<string>();
    const result: Cell[] = [];

    for (const cell of cells) {
        if (!isInBounds(cell.r, cell.c)) continue;
        const key = cellKey(cell);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(cell);
    }

    return result;
}

function sortLineCells(cells: Cell[], axis: LineAxis): Cell[] {
    return [...cells].sort(axis === 'horizontal'
        ? (a, b) => a.c - b.c
        : (a, b) => a.r - b.r);
}

function bresenhamLine(r0: number, c0: number, r1: number, c1: number): Cell[] {
    const cells: Cell[] = [];
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
        if (e2 > -dr) {
            err -= dr;
            cc += sc;
        }
        if (e2 < dc) {
            err += dc;
            cr += sr;
        }
    }

    return cells;
}

function createPivotCandidate(start: Cell, end: Cell, walls: boolean[][]): PivotCandidate | null {
    if (start.r !== end.r && start.c !== end.c) return null;
    const axis: LineAxis = start.r === end.r ? 'horizontal' : 'vertical';
    const cells = sortLineCells(bresenhamLine(start.r, start.c, end.r, end.c), axis);

    if (cells.length < 2) return null;
    if (!cells.every(({ r, c }) => isInBounds(r, c) && walls[r][c])) return null;

    return { axis, cells };
}

function composeWallGrid(baseWalls: boolean[][], extraWalls: Cell[]): boolean[][] {
    const composed = cloneWallGrid(baseWalls);
    for (const { r, c } of extraWalls) {
        if (isInBounds(r, c)) composed[r][c] = true;
    }
    return composed;
}

function displaceWaterFromWallCell(walls: boolean[][], waterGrid: Float32Array[], r: number, c: number) {
    let displaced = waterGrid[r][c];
    waterGrid[r][c] = 0;
    let cr = r - 1;

    while (cr >= 0 && displaced > 0) {
        if (!walls[cr][c]) {
            const space = 1.0 - waterGrid[cr][c];
            if (space > 0) {
                const transfer = Math.min(space, displaced);
                waterGrid[cr][c] += transfer;
                displaced -= transfer;
            }
        }
        cr--;
    }
}

function transformPivotCenters(pivotWall: PivotWall): Array<{ x: number; y: number }> {
    const cos = Math.cos(pivotWall.angle);
    const sin = Math.sin(pivotWall.angle);

    return pivotWall.localCenters.map(({ dx, dy }) => ({
        x: pivotWall.pivot.x + dx * cos - dy * sin,
        y: pivotWall.pivot.y + dx * sin + dy * cos,
    }));
}

function computePivotOccupiedCells(pivotWall: PivotWall): Cell[] {
    const points = transformPivotCenters(pivotWall);
    if (!points.length) return [];

    const occupied: Cell[] = [];

    for (let i = 0; i < points.length; i++) {
        const pointCell = {
            r: Math.floor(points[i].y),
            c: Math.floor(points[i].x),
        };
        occupied.push(pointCell);

        if (i === 0) continue;

        const prevCell = {
            r: Math.floor(points[i - 1].y),
            c: Math.floor(points[i - 1].x),
        };
        occupied.push(...bresenhamLine(prevCell.r, prevCell.c, pointCell.r, pointCell.c));
    }

    return uniqueCells(occupied);
}

function computePivotInertia(pivotWall: PivotWall): number {
    let inertia = 0;

    for (const { dx, dy } of pivotWall.localCenters) {
        const rx = dx * METERS_PER_CELL;
        const ry = dy * METERS_PER_CELL;
        inertia += PIVOT_CELL_MASS * (rx * rx + ry * ry);
    }

    return Math.max(650, inertia);
}

function getPivotOrientation(axis: LineAxis, angle: number) {
    if (axis === 'horizontal') {
        return { tx: Math.cos(angle), ty: Math.sin(angle) };
    }
    return { tx: -Math.sin(angle), ty: Math.cos(angle) };
}

// --- Hybrid Exact Topological Fluid Solver ---
function updateSurfacesAndTick(grid: Float32Array[], walls: boolean[][]): Float32Array[] {
    const R = GRID_ROWS;
    const C = GRID_COLS;
    const surfaceMap = Array.from({ length: R }, () => new Float32Array(C).fill(-1));

    for (let pass = 0; pass < 3; pass++) {
        const nextGrid = grid.map((row) => new Float32Array(row));
        for (let r = R - 2; r >= 0; r--) {
            for (let c = 0; c < C; c++) {
                if (walls[r][c] || grid[r][c] < 0.01) continue;
                const m = grid[r][c];
                if (!walls[r + 1][c]) {
                    const space = 1.0 - nextGrid[r + 1][c];
                    if (space > 0) {
                        const flow = Math.min(m, space, 0.4);
                        nextGrid[r][c] -= flow;
                        nextGrid[r + 1][c] += flow;
                    }
                }
            }
        }
        for (let r = 0; r < R; r++) {
            for (let c = 0; c < C; c++) {
                grid[r][c] = nextGrid[r][c];
            }
        }

        const visited = Array.from({ length: R }, () => new Array(C).fill(false));
        for (let startR = 0; startR < R; startR++) {
            for (let startC = 0; startC < C; startC++) {
                if (!visited[startR][startC] && grid[startR][startC] > 0.05 && !walls[startR][startC]) {
                    const comp: Cell[] = [];
                    const q = [{ r: startR, c: startC }];
                    visited[startR][startC] = true;

                    while (q.length > 0) {
                        const curr = q.shift()!;
                        comp.push(curr);
                        for (const [dr, dc] of NEIGHBORS) {
                            const nr = curr.r + dr;
                            const nc = curr.c + dc;
                            if (nr >= 0 && nr < R && nc >= 0 && nc < C && !walls[nr][nc]) {
                                if (!visited[nr][nc] && grid[nr][nc] > 0.01) {
                                    visited[nr][nc] = true;
                                    q.push({ r: nr, c: nc });
                                }
                            }
                        }
                    }

                    const providers: { r: number; c: number; h: number }[] = [];
                    const receivers: { r: number; c: number; h: number }[] = [];
                    const recVisited = Array.from({ length: R }, () => new Array(C).fill(false));

                    const addRec = (r: number, c: number, h: number) => {
                        if (r < 0 || r >= R || c < 0 || c >= C || walls[r][c]) return;
                        if (!recVisited[r][c]) {
                            recVisited[r][c] = true;
                            receivers.push({ r, c, h });
                        }
                    };

                    let minH = 999;
                    for (const cell of comp) {
                        const { r, c } = cell;
                        const m = grid[r][c];
                        const h = r + 1 - m;
                        if (h < minH) minH = h;

                        providers.push({ r, c, h });

                        if (m < 0.98) addRec(r, c, h);
                        if (r > 0 && grid[r - 1][c] <= 0.02) addRec(r - 1, c, r);
                        if (c > 0 && grid[r][c - 1] <= 0.02) addRec(r, c - 1, r + 1);
                        if (c < C - 1 && grid[r][c + 1] <= 0.02) addRec(r, c + 1, r + 1);
                    }

                    for (const cell of comp) surfaceMap[cell.r][cell.c] = minH;

                    providers.sort((a, b) => a.h - b.h);
                    receivers.sort((a, b) => b.h - a.h);

                    let pIdx = 0;
                    let rIdx = 0;
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

function getPressureKPa(
    x: number,
    y: number,
    grid: Float32Array[],
    walls: boolean[][],
    gravity: number,
    isOpen: boolean,
    surfaceMap: Float32Array[]
): number {
    const p0 = isOpen ? ATM_PRESSURE : 0;
    const c = Math.floor(clamp(x, 0, GRID_COLS - 1));
    const r = Math.floor(clamp(y, 0, GRID_ROWS - 1));

    if (walls[r][c] || grid[r][c] <= 0.01 || surfaceMap[r][c] === -1) return p0;
    const depthMeters = Math.max(0, (y - surfaceMap[r][c]) * METERS_PER_CELL);
    return p0 + (WATER_DENSITY * gravity * depthMeters) / 1000;
}

function evaluatePivotDiagnostics(
    pivotWall: PivotWall,
    walls: boolean[][],
    grid: Float32Array[],
    gravity: number,
    isOpen: boolean,
    surfaceMap: Float32Array[]
): PivotDiagnostics {
    const { tx, ty } = getPivotOrientation(pivotWall.axis, pivotWall.angle);
    const nx = -ty;
    const ny = tx;
    const points = transformPivotCenters(pivotWall);

    let torque = 0;
    let pressureDelta = 0;

    for (const point of points) {
        const pPlus = getPressureKPa(
            point.x + nx * PIVOT_SAMPLE_OFFSET,
            point.y + ny * PIVOT_SAMPLE_OFFSET,
            grid,
            walls,
            gravity,
            isOpen,
            surfaceMap
        );
        const pMinus = getPressureKPa(
            point.x - nx * PIVOT_SAMPLE_OFFSET,
            point.y - ny * PIVOT_SAMPLE_OFFSET,
            grid,
            walls,
            gravity,
            isOpen,
            surfaceMap
        );

        const deltaP = pMinus - pPlus;
        const forceMagnitude = deltaP * 1000 * WALL_FACE_AREA;
        const fx = nx * forceMagnitude;
        const fy = ny * forceMagnitude;
        const rx = (point.x - pivotWall.pivot.x) * METERS_PER_CELL;
        const ry = (point.y - pivotWall.pivot.y) * METERS_PER_CELL;

        torque += rx * fy - ry * fx;
        pressureDelta += deltaP;
    }

    return {
        torque,
        pressureDelta: points.length > 0 ? pressureDelta / points.length : 0,
    };
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

function createInitialWaterGrid(): Float32Array[] {
    const grid = Array.from({ length: GRID_ROWS }, () => new Float32Array(GRID_COLS));
    for (let c = 1; c < GRID_COLS - 1; c++) {
        if (c === 15) continue;
        for (let r = 8; r < GRID_ROWS - 1; r++) {
            grid[r][c] = 1.0;
        }
    }
    return grid;
}

export default function HydrostaticPressure() {
    const [simState, setSimState] = useState<SimState>(() => ({ wallGrid: createInitialWallGrid() }));
    const waterGridRef = useRef<Float32Array[]>(createInitialWaterGrid());
    const surfaceMapRef = useRef<Float32Array[]>(Array.from({ length: GRID_ROWS }, () => new Float32Array(GRID_COLS).fill(-1)));
    const pivotWallRef = useRef<PivotWall | null>(null);
    const pivotDragStartRef = useRef<Cell | null>(null);
    const previewCellsRef = useRef<Cell[]>([]);
    const lastFrameTimeRef = useRef<number | null>(null);

    const [gravity, setGravity] = useState(9.81);
    const [isOpenAtmosphere, setIsOpenAtmosphere] = useState(true);
    const [toolMode, setToolMode] = useState<ToolMode>('draw');
    const [showPressureField, setShowPressureField] = useState(false);
    const [showWallForces, setShowWallForces] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSimulationPlaying, setIsSimulationPlaying] = useState(true);
    const [pivotCandidate, setPivotCandidate] = useState<PivotCandidate | null>(null);
    const [pivotPreviewCells, setPivotPreviewCells] = useState<Cell[]>([]);
    const [pivotStatus, setPivotStatus] = useState('Selecciona una línea recta de muro para convertirla en compuerta.');
    const [pivotTelemetry, setPivotTelemetry] = useState({ exists: false, angle: 0, angularVelocity: 0, torque: 0, pressureDelta: 0 });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const lastCellRef = useRef<Cell | null>(null);

    const stateRef = useRef({
        wallGrid: simState.wallGrid,
        gravity,
        isOpenAtmosphere,
        showPressureField,
        showWallForces,
        isSimulationPlaying,
    });

    useEffect(() => {
        stateRef.current = {
            wallGrid: simState.wallGrid,
            gravity,
            isOpenAtmosphere,
            showPressureField,
            showWallForces,
            isSimulationPlaying,
        };
    }, [simState.wallGrid, gravity, isOpenAtmosphere, showPressureField, showWallForces, isSimulationPlaying]);

    useEffect(() => {
        previewCellsRef.current = pivotPreviewCells;
    }, [pivotPreviewCells]);

    useEffect(() => {
        lastFrameTimeRef.current = null;
    }, [isSimulationPlaying]);

    const getEffectiveWallGrid = useCallback((baseWalls: boolean[][] = stateRef.current.wallGrid) => {
        const pivotWall = pivotWallRef.current;
        if (!pivotWall) return baseWalls;
        return composeWallGrid(baseWalls, computePivotOccupiedCells(pivotWall));
    }, []);

    const clearPivotConstruction = useCallback((nextStatus?: string) => {
        pivotDragStartRef.current = null;
        isDrawingRef.current = false;
        lastCellRef.current = null;
        setPivotCandidate(null);
        setPivotPreviewCells([]);
        if (nextStatus) setPivotStatus(nextStatus);
    }, []);

    const createPivotWall = useCallback((candidate: PivotCandidate, pivotCell: Cell) => {
        const localCenters = candidate.cells.map((cell) => ({
            dx: cell.c - pivotCell.c,
            dy: cell.r - pivotCell.r,
        }));

        pivotWallRef.current = {
            axis: candidate.axis,
            cells: candidate.cells,
            pivotCell,
            pivot: { x: pivotCell.c + 0.5, y: pivotCell.r + 0.5 },
            localCenters,
            angle: 0,
            angularVelocity: 0,
            lastTorque: 0,
            lastPressureDelta: 0,
        };

        setSimState((prev) => {
            const newWall = cloneWallGrid(prev.wallGrid);
            for (const cell of candidate.cells) newWall[cell.r][cell.c] = false;
            return { wallGrid: newWall };
        });

        setPivotTelemetry({ exists: true, angle: 0, angularVelocity: 0, torque: 0, pressureDelta: 0 });
        setIsSimulationPlaying(false);
        setToolMode('pivot');
        clearPivotConstruction('Pivote creado. Pulsa play para liberar la compuerta.');
    }, [clearPivotConstruction]);

    const removePivotWall = useCallback(() => {
        const pivotWall = pivotWallRef.current;
        if (!pivotWall) return;

        setSimState((prev) => {
            const newWall = cloneWallGrid(prev.wallGrid);
            for (const cell of pivotWall.cells) {
                if (newWall[cell.r][cell.c]) continue;
                newWall[cell.r][cell.c] = true;
                displaceWaterFromWallCell(newWall, waterGridRef.current, cell.r, cell.c);
            }
            return { wallGrid: newWall };
        });

        pivotWallRef.current = null;
        setPivotTelemetry({ exists: false, angle: 0, angularVelocity: 0, torque: 0, pressureDelta: 0 });
        setIsSimulationPlaying(true);
        clearPivotConstruction('Pivote retirado. El muro volvió a quedar bloqueado.');
    }, [clearPivotConstruction]);

    const resetPivotWall = useCallback(() => {
        const pivotWall = pivotWallRef.current;
        if (!pivotWall) return;

        pivotWall.angle = 0;
        pivotWall.angularVelocity = 0;
        pivotWall.lastTorque = 0;
        pivotWall.lastPressureDelta = 0;
        setPivotTelemetry((prev) => ({ ...prev, angle: 0, angularVelocity: 0, torque: 0, pressureDelta: 0, exists: true }));
        setPivotStatus('Compuerta reiniciada a su orientación original.');
    }, []);

    const applyTool = useCallback((r: number, c: number) => {
        if (!isInBounds(r, c)) return;

        const currentWalls = getEffectiveWallGrid(simState.wallGrid);

        if (toolMode === 'addWater') {
            if (!currentWalls[r][c]) waterGridRef.current[r][c] = Math.min(1.0, waterGridRef.current[r][c] + 0.3);
            return;
        }

        if (toolMode === 'removeWater') {
            waterGridRef.current[r][c] = Math.max(0, waterGridRef.current[r][c] - 0.3);
            return;
        }

        if (toolMode === 'pivot') return;

        setSimState((prev) => {
            const effectiveWalls = getEffectiveWallGrid(prev.wallGrid);

            if (toolMode === 'draw') {
                if (effectiveWalls[r][c]) return prev;
                const newWall = cloneWallGrid(prev.wallGrid);
                newWall[r][c] = true;
                displaceWaterFromWallCell(newWall, waterGridRef.current, r, c);
                return { wallGrid: newWall };
            }

            if (toolMode === 'erase') {
                if (!prev.wallGrid[r][c] || r === GRID_ROWS - 1 || c === 0 || c === GRID_COLS - 1) return prev;
                const newWall = cloneWallGrid(prev.wallGrid);
                newWall[r][c] = false;
                return { wallGrid: newWall };
            }

            return prev;
        });
    }, [toolMode, simState.wallGrid, getEffectiveWallGrid]);

    const getGridCoords = useCallback((e: React.MouseEvent | React.TouchEvent | React.PointerEvent | PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0, r: 0, c: 0 };

        const rect = canvas.getBoundingClientRect();
        const point = 'touches' in e ? e.touches[0] : e;
        const px = point.clientX - rect.left;
        const py = point.clientY - rect.top;
        const cellW = rect.width / GRID_COLS;
        const cellH = rect.height / GRID_ROWS;
        const c = clamp(Math.floor(px / cellW), 0, GRID_COLS - 1);
        const r = clamp(Math.floor(py / cellH), 0, GRID_ROWS - 1);

        return { x: px / cellW, y: py / cellH, c, r };
    }, []);

    const finalizePivotSelection = useCallback((r: number, c: number) => {
        if (!pivotCandidate) return;

        const pivotCell = pivotCandidate.cells.find((cell) => cell.r === r && cell.c === c);
        if (!pivotCell) {
            setPivotStatus('El pivote debe colocarse sobre uno de los bloques resaltados.');
            return;
        }

        createPivotWall(pivotCandidate, pivotCell);
    }, [pivotCandidate, createPivotWall]);

    const handlePointerDown = (e: React.PointerEvent) => {
        const { r, c } = getGridCoords(e);
        lastCellRef.current = { r, c };

        if (toolMode === 'pivot') {
            if (pivotCandidate) {
                finalizePivotSelection(r, c);
                return;
            }

            if (pivotWallRef.current) {
                setPivotStatus('Ya existe una compuerta con pivote. Retírala antes de crear otra.');
                return;
            }

            const walls = getEffectiveWallGrid(simState.wallGrid);
            if (!walls[r][c]) {
                setPivotStatus('Empieza la selección sobre una línea de muro.');
                return;
            }

            pivotDragStartRef.current = { r, c };
            isDrawingRef.current = true;
            setPivotPreviewCells([{ r, c }]);
            setPivotStatus('Arrastra en horizontal o vertical para definir la compuerta.');
            try {
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
                // no-op
            }
            return;
        }

        isDrawingRef.current = true;
        applyTool(r, c);
        try {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
            // no-op
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const { r, c } = getGridCoords(e);

        if (toolMode === 'pivot') {
            if (!isDrawingRef.current || !pivotDragStartRef.current) return;
            const start = pivotDragStartRef.current;

            if (start.r !== r && start.c !== c) {
                setPivotPreviewCells([]);
                setPivotStatus('La selección del pivote solo admite líneas horizontales o verticales.');
                return;
            }

            const candidate = createPivotCandidate(start, { r, c }, getEffectiveWallGrid(simState.wallGrid));
            setPivotPreviewCells(candidate?.cells ?? []);
            return;
        }

        if (!isDrawingRef.current) return;
        const prev = lastCellRef.current;
        if (prev && (prev.r !== r || prev.c !== c)) {
            bresenhamLine(prev.r, prev.c, r, c).forEach(({ r: cr, c: cc }) => applyTool(cr, cc));
        } else {
            applyTool(r, c);
        }
        lastCellRef.current = { r, c };
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        try {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
            // no-op
        }

        if (toolMode === 'pivot') {
            const start = pivotDragStartRef.current;
            isDrawingRef.current = false;
            lastCellRef.current = null;
            pivotDragStartRef.current = null;

            if (!start) return;

            const { r, c } = getGridCoords(e);
            const candidate = createPivotCandidate(start, { r, c }, getEffectiveWallGrid(simState.wallGrid));
            if (!candidate) {
                setPivotPreviewCells([]);
                setPivotStatus('La compuerta debe ser una línea continua de al menos 2 bloques.');
                return;
            }

            setPivotCandidate(candidate);
            setPivotPreviewCells(candidate.cells);
            setPivotStatus('Ahora haz clic sobre uno de los bloques seleccionados para fijar el pivote.');
            return;
        }

        isDrawingRef.current = false;
        lastCellRef.current = null;
    };

    useEffect(() => {
        let animationId = 0;
        let frameCount = 0;

        const renderLoop = (time: number) => {
            frameCount++;

            const {
                wallGrid,
                gravity,
                showPressureField,
                showWallForces,
                isOpenAtmosphere,
                isSimulationPlaying,
            } = stateRef.current;

            const grid = waterGridRef.current;
            const pivotWall = pivotWallRef.current;
            let dynamicWalls = pivotWall ? computePivotOccupiedCells(pivotWall) : [];
            let effectiveWalls = composeWallGrid(wallGrid, dynamicWalls);

            if (lastFrameTimeRef.current === null) lastFrameTimeRef.current = time;
            const dt = clamp((time - lastFrameTimeRef.current) / 1000, 0.008, 0.033);
            lastFrameTimeRef.current = time;

            if (isSimulationPlaying) {
                surfaceMapRef.current = updateSurfacesAndTick(grid, effectiveWalls);
            } else {
                const snapshot = grid.map((row) => new Float32Array(row));
                surfaceMapRef.current = updateSurfacesAndTick(snapshot, effectiveWalls);
            }

            const surfaceMap = surfaceMapRef.current;

            if (pivotWall) {
                if (isSimulationPlaying) {
                    const substeps = Math.max(1, Math.ceil(dt / 0.016));
                    const subDt = dt / substeps;
                    const inertia = computePivotInertia(pivotWall);

                    for (let i = 0; i < substeps; i++) {
                        const wallsNow = composeWallGrid(wallGrid, computePivotOccupiedCells(pivotWall));
                        const currentDiag = evaluatePivotDiagnostics(
                            pivotWall,
                            wallsNow,
                            grid,
                            gravity,
                            isOpenAtmosphere,
                            surfaceMap
                        );

                        const alpha = (currentDiag.torque - PIVOT_DAMPING * pivotWall.angularVelocity) / inertia;
                        const omegaHalf = clamp(
                            pivotWall.angularVelocity + 0.5 * alpha * subDt,
                            -MAX_ANGULAR_SPEED,
                            MAX_ANGULAR_SPEED
                        );

                        pivotWall.angle = clamp(pivotWall.angle + omegaHalf * subDt, -MAX_PIVOT_ANGLE, MAX_PIVOT_ANGLE);

                        const wallsNext = composeWallGrid(wallGrid, computePivotOccupiedCells(pivotWall));
                        const nextDiag = evaluatePivotDiagnostics(
                            pivotWall,
                            wallsNext,
                            grid,
                            gravity,
                            isOpenAtmosphere,
                            surfaceMap
                        );

                        const alphaNext = (nextDiag.torque - PIVOT_DAMPING * omegaHalf) / inertia;
                        pivotWall.angularVelocity = clamp(
                            omegaHalf + 0.5 * alphaNext * subDt,
                            -MAX_ANGULAR_SPEED,
                            MAX_ANGULAR_SPEED
                        );
                        pivotWall.lastTorque = nextDiag.torque;
                        pivotWall.lastPressureDelta = nextDiag.pressureDelta;

                        if (Math.abs(pivotWall.angle) >= MAX_PIVOT_ANGLE - 0.001) {
                            pivotWall.angularVelocity = 0;
                        }
                    }
                } else {
                    const diag = evaluatePivotDiagnostics(
                        pivotWall,
                        effectiveWalls,
                        grid,
                        gravity,
                        isOpenAtmosphere,
                        surfaceMap
                    );
                    pivotWall.lastTorque = diag.torque;
                    pivotWall.lastPressureDelta = diag.pressureDelta;
                }

                dynamicWalls = computePivotOccupiedCells(pivotWall);
                effectiveWalls = composeWallGrid(wallGrid, dynamicWalls);
            }

            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) {
                animationId = requestAnimationFrame(renderLoop);
                return;
            }

            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) {
                animationId = requestAnimationFrame(renderLoop);
                return;
            }

            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }

            const w = rect.width;
            const h = rect.height;
            const cellW = w / GRID_COLS;
            const cellH = h / GRID_ROWS;

            ctx.fillStyle = '#0a0a0f';
            ctx.fillRect(0, 0, w, h);

            ctx.strokeStyle = 'rgba(0, 230, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let r = 0; r <= GRID_ROWS; r++) {
                ctx.moveTo(0, r * cellH);
                ctx.lineTo(w, r * cellH);
            }
            for (let c = 0; c <= GRID_COLS; c++) {
                ctx.moveTo(c * cellW, 0);
                ctx.lineTo(c * cellW, h);
            }
            ctx.stroke();

            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    if (effectiveWalls[r][c]) continue;
                    const m = grid[r][c];
                    if (m <= 0.05) continue;

                    let fill = m;
                    if (r > 0 && !effectiveWalls[r - 1][c] && grid[r - 1][c] > 0.05) fill = 1.0;

                    if (showPressureField) {
                        const surface = surfaceMap[r][c] !== -1 ? surfaceMap[r][c] : (r + 1 - m);
                        const depth = Math.max(0, (r + 0.5) - surface);
                        const hue = Math.max(0, 240 - (depth / 16) * 240);
                        ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${0.7 + fill * 0.3})`;
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

                    if (r === 0 || effectiveWalls[r - 1][c] || grid[r - 1][c] <= 0.05) {
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(c * cellW, y);
                        ctx.lineTo((c + 1) * cellW, y);
                        ctx.stroke();
                        ctx.shadowColor = 'rgba(0, 230, 255, 0.8)';
                        ctx.shadowBlur = 5;
                        ctx.stroke();
                        ctx.shadowBlur = 0;
                    }
                }
            }

            const drawWallCell = (r: number, c: number, isDynamic: boolean) => {
                ctx.fillStyle = isDynamic ? '#312e81' : '#1e293b';
                ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);

                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(c * cellW, r * cellH + cellH);
                ctx.lineTo(c * cellW + cellW, r * cellH);
                ctx.stroke();

                ctx.strokeStyle = isDynamic ? '#67e8f9' : '#334155';
                ctx.strokeRect(c * cellW + 1.5, r * cellH + 1.5, cellW - 3, cellH - 3);
            };

            const drawForceVector = (r: number, c: number) => {
                for (const [dr, dc] of NEIGHBORS) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (!isInBounds(nr, nc) || effectiveWalls[nr][nc]) continue;

                    const p = getPressureKPa(
                        nc + 0.5,
                        nr + 0.5,
                        grid,
                        effectiveWalls,
                        gravity,
                        isOpenAtmosphere,
                        surfaceMap
                    ) - (isOpenAtmosphere ? ATM_PRESSURE : 0);

                    if (p <= 0.01) continue;

                    const len = cellW * (0.2 + 0.8 * Math.min(1, p / FORCE_VECTOR_SCALE_KPA));
                    const vx = -dc;
                    const vy = -dr;
                    const x1 = (nc + 0.5 - vx * 0.15) * cellW;
                    const y1 = (nr + 0.5 - vy * 0.15) * cellH;
                    const x2 = x1 + vx * len;
                    const y2 = y1 + vy * len;
                    const head = Math.min(7, len * 0.4);

                    ctx.strokeStyle = '#f97316';
                    ctx.fillStyle = '#f97316';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(x2, y2);
                    ctx.lineTo(x2 - vx * head - vy * head * 0.5, y2 - vy * head + vx * head * 0.5);
                    ctx.lineTo(x2 - vx * head + vy * head * 0.5, y2 - vy * head - vx * head * 0.5);
                    ctx.fill();
                }
            };

            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    if (!wallGrid[r][c]) continue;
                    drawWallCell(r, c, false);
                    if (showWallForces) drawForceVector(r, c);
                }
            }

            for (const cell of dynamicWalls) {
                drawWallCell(cell.r, cell.c, true);
                if (showWallForces) drawForceVector(cell.r, cell.c);
            }

            const previewCells = previewCellsRef.current;
            if (previewCells.length > 0) {
                for (const cell of previewCells) {
                    ctx.fillStyle = 'rgba(168, 85, 247, 0.22)';
                    ctx.fillRect(cell.c * cellW, cell.r * cellH, cellW, cellH);
                    ctx.strokeStyle = 'rgba(216, 180, 254, 0.95)';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(cell.c * cellW + 1.5, cell.r * cellH + 1.5, cellW - 3, cellH - 3);
                }
            }

            if (pivotWall) {
                const centers = transformPivotCenters(pivotWall);
                if (centers.length > 1) {
                    ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(centers[0].x * cellW, centers[0].y * cellH);
                    for (let i = 1; i < centers.length; i++) {
                        ctx.lineTo(centers[i].x * cellW, centers[i].y * cellH);
                    }
                    ctx.stroke();
                }

                ctx.fillStyle = '#f8fafc';
                ctx.beginPath();
                ctx.arc(pivotWall.pivot.x * cellW, pivotWall.pivot.y * cellH, 5.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#22d3ee';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pivotWall.pivot.x * cellW, pivotWall.pivot.y * cellH, 9.5, 0, Math.PI * 2);
                ctx.stroke();
            }

            if (frameCount % 10 === 0) {
                if (pivotWallRef.current) {
                    setPivotTelemetry({
                        exists: true,
                        angle: pivotWallRef.current.angle,
                        angularVelocity: pivotWallRef.current.angularVelocity,
                        torque: pivotWallRef.current.lastTorque,
                        pressureDelta: pivotWallRef.current.lastPressureDelta,
                    });
                }
            }

            animationId = requestAnimationFrame(renderLoop);
        };

        animationId = requestAnimationFrame(renderLoop);
        return () => cancelAnimationFrame(animationId);
    }, []);

    const pivotExists = Boolean(pivotWallRef.current);
    const pivotModeActive = toolMode === 'pivot';

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] w-full bg-[#050508] text-slate-200 overflow-hidden font-sans">
            <div className="flex-1 relative w-full h-full order-1 md:order-1 min-h-[50vh]">
                <div
                    ref={containerRef}
                    className={cn(
                        'absolute inset-0 w-full h-full touch-none',
                        toolMode === 'draw' ? 'cursor-crosshair' : toolMode === 'pivot' ? 'cursor-pointer' : 'cursor-cell'
                    )}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                >
                    <canvas ref={canvasRef} className="block w-full h-full" />
                </div>

                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="absolute top-4 right-4 z-50 bg-slate-900/80 border border-white/10 p-2.5 rounded-lg text-slate-300 hover:text-white backdrop-blur shadow-lg transition-transform active:scale-95 flex items-center justify-center"
                    title="Alternar Centro de Control"
                >
                    {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>

            {isSidebarOpen && (
                <div className="w-full md:w-[340px] bg-slate-900 border-t md:border-t-0 md:border-l border-white/5 flex flex-col order-2 md:order-2 z-10 shadow-[-8px_0_30px_rgba(0,0,0,0.5)] md:h-full max-h-[60vh] md:max-h-full overflow-y-auto custom-scrollbar shrink-0 absolute md:static bottom-0 left-0 right-0 max-md:rounded-t-2xl">
                    <div className="p-4 border-b border-white/5 top-0 sticky bg-slate-900 z-10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-cyan-400" />
                            <h3 className="font-bold uppercase tracking-wider text-white">Centro de Control</h3>
                        </div>
                    </div>

                    <div className="p-4 flex flex-col gap-6 flex-1">
                        <div>
                            <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3">Física y Visualización</h4>
                            <div className="flex flex-col gap-2">
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => setShowPressureField((v) => !v)} className={cn('p-3 rounded-lg border flex items-center justify-between transition-all w-full', showPressureField ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'bg-slate-950 border-white/5 text-slate-400 hover:bg-slate-800')}>
                                        <span className="text-[11px] uppercase font-bold tracking-widest flex items-center gap-2"><Layers size={14} /> Campo de Presiones</span>
                                        <div className={cn('w-2 h-2 rounded-full', showPressureField ? 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]' : 'bg-slate-600')} />
                                    </button>

                                    {showPressureField && (
                                        <div className="px-1 text-[9px] uppercase font-bold text-slate-400 mb-1">
                                            <div className="flex justify-between mb-1.5 opacity-80">
                                                <span>Menor Presión</span>
                                                <span>Mayor Presión</span>
                                            </div>
                                            <div className="w-full h-2 rounded-full border border-white/10" style={{ background: 'linear-gradient(to right, hsl(240, 100%, 50%), hsl(120, 100%, 50%), hsl(0, 100%, 50%))' }}></div>
                                        </div>
                                    )}
                                </div>

                                <button onClick={() => setShowWallForces((v) => !v)} className={cn('p-3 rounded-lg border flex items-center justify-between transition-all w-full', showWallForces ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-slate-950 border-white/5 text-slate-400 hover:bg-slate-800')}>
                                    <span className="text-[11px] uppercase font-bold tracking-widest flex items-center gap-2"><Target size={14} /> Fuerzas en Muros</span>
                                    <div className={cn('w-2 h-2 rounded-full', showWallForces ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'bg-slate-600')} />
                                </button>

                                <button onClick={() => setIsOpenAtmosphere((v) => !v)} className={cn('p-3 rounded-lg border flex items-center justify-between transition-all mt-1.5', isOpenAtmosphere ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-slate-950/80 border-rose-500/30 text-rose-400')}>
                                    <span className="text-[11px] uppercase font-bold tracking-widest">{isOpenAtmosphere ? 'Atmósfera Abierta' : 'Tanque Sellado (0 ATM)'}</span>
                                    {isOpenAtmosphere ? <Download size={14} className="animate-pulse" /> : <X size={14} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Gravedad (Planetas)</h4>
                                <span className="font-mono text-cyan-400 text-[11px] px-2 py-0.5 bg-slate-950 rounded border border-cyan-500/30 font-bold">{gravity.toFixed(2)} m/s²</span>
                            </div>
                            <input type="range" min={GRAVITY_MIN} max={GRAVITY_MAX} step={0.01} value={gravity} onChange={(e) => setGravity(Number(e.target.value))} className="w-full accent-cyan-500 mb-3" />
                            <div className="grid grid-cols-4 gap-1.5">
                                {GRAVITY_REFS.map((ref) => (
                                    <button key={ref.name} onClick={() => setGravity(ref.g)} className={cn('py-2 rounded text-[10px] uppercase font-bold border transition-colors', Math.abs(gravity - ref.g) < 0.1 ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'bg-slate-950 border-white/10 text-slate-500 hover:text-white hover:border-white/20')}>
                                        {ref.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-3 gap-3">
                                <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Constructor Físico</h4>
                                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">{pivotModeActive ? 'Modo pivote' : 'Edición libre'}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => setToolMode('draw')} className={cn('p-2.5 rounded-lg border flex flex-col items-center gap-2 transition-all', toolMode === 'draw' ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'bg-slate-950/50 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white')}>
                                    <PenTool size={18} /><span className="text-[10px] uppercase font-bold tracking-widest">Muro</span>
                                </button>
                                <button onClick={() => setToolMode('erase')} className={cn('p-2.5 rounded-lg border flex flex-col items-center gap-2 transition-all', toolMode === 'erase' ? 'bg-rose-500/20 border-rose-500/50 text-rose-300' : 'bg-slate-950/50 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white')}>
                                    <Eraser size={18} /><span className="text-[10px] uppercase font-bold tracking-widest">Borrar</span>
                                </button>
                                <button onClick={() => setToolMode('pivot')} className={cn('p-2.5 rounded-lg border flex flex-col items-center gap-2 transition-all', toolMode === 'pivot' ? 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-200' : 'bg-slate-950/50 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white')}>
                                    <Target size={18} /><span className="text-[10px] uppercase font-bold tracking-widest">Pivote</span>
                                </button>
                                <button onClick={() => setToolMode('addWater')} className={cn('p-2.5 rounded-lg border flex flex-col items-center gap-2 transition-all', toolMode === 'addWater' ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-slate-950/50 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white')}>
                                    <Droplets size={18} /><span className="text-[10px] uppercase font-bold tracking-widest">Inyectar</span>
                                </button>
                                <button onClick={() => setToolMode('removeWater')} className={cn('p-2.5 rounded-lg border flex flex-col items-center gap-2 transition-all', toolMode === 'removeWater' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-slate-950/50 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white')}>
                                    <X size={18} /><span className="text-[10px] uppercase font-bold tracking-widest">Drenar</span>
                                </button>
                            </div>

                            <div className="mt-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-3">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <span className="text-[10px] uppercase tracking-[0.24em] font-bold text-fuchsia-200">Creador de pivotes</span>
                                    <span className={cn('text-[10px] uppercase font-bold', pivotExists ? 'text-cyan-300' : pivotCandidate ? 'text-fuchsia-200' : 'text-slate-500')}>
                                        {pivotExists ? 'Compuerta activa' : pivotCandidate ? 'Esperando pivote' : 'Sin pivote'}
                                    </span>
                                </div>
                                <p className="text-[11px] leading-relaxed text-slate-300">{pivotStatus}</p>
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => setIsSimulationPlaying((prev) => !prev)}
                                        disabled={!pivotExists}
                                        className={cn('py-2 rounded-lg border text-[10px] uppercase font-bold tracking-widest flex items-center justify-center gap-1.5 transition-colors', pivotExists ? 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10' : 'border-white/10 text-slate-600 cursor-not-allowed')}
                                    >
                                        {isSimulationPlaying ? <Pause size={14} /> : <Play size={14} />}
                                        {isSimulationPlaying ? 'Pausa' : 'Play'}
                                    </button>
                                    <button
                                        onClick={resetPivotWall}
                                        disabled={!pivotExists}
                                        className={cn('py-2 rounded-lg border text-[10px] uppercase font-bold tracking-widest flex items-center justify-center gap-1.5 transition-colors', pivotExists ? 'border-sky-500/40 text-sky-300 hover:bg-sky-500/10' : 'border-white/10 text-slate-600 cursor-not-allowed')}
                                    >
                                        <RotateCcw size={14} /> Reiniciar
                                    </button>
                                    <button
                                        onClick={removePivotWall}
                                        disabled={!pivotExists}
                                        className={cn('py-2 rounded-lg border text-[10px] uppercase font-bold tracking-widest flex items-center justify-center gap-1.5 transition-colors', pivotExists ? 'border-rose-500/40 text-rose-300 hover:bg-rose-500/10' : 'border-white/10 text-slate-600 cursor-not-allowed')}
                                    >
                                        <X size={14} /> Quitar
                                    </button>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] uppercase font-bold">
                                    <div className="rounded-lg border border-white/10 bg-slate-950/70 p-2.5">
                                        <div className="text-slate-500 mb-1">Torque</div>
                                        <div className="font-mono text-amber-300">{pivotTelemetry.exists ? `${(pivotTelemetry.torque / 1000).toFixed(2)} kN·m` : '—'}</div>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-slate-950/70 p-2.5">
                                        <div className="text-slate-500 mb-1">Desequilibrio</div>
                                        <div className="font-mono text-emerald-300">{pivotTelemetry.exists ? `${pivotTelemetry.pressureDelta.toFixed(2)} kPa` : '—'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto mb-2 pt-4 border-t border-white/5">
                            <button
                                onClick={() => {
                                    pivotWallRef.current = null;
                                    waterGridRef.current = createInitialWaterGrid();
                                    setIsSimulationPlaying(true);
                                    setSimState({ wallGrid: createInitialWallGrid() });
                                    setPivotTelemetry({ exists: false, angle: 0, angularVelocity: 0, torque: 0, pressureDelta: 0 });
                                    clearPivotConstruction('Entorno restaurado. Puedes volver a construir el tanque.');
                                }}
                                className="w-full py-3 rounded-lg text-[11px] font-bold uppercase tracking-widest border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition-colors flex justify-center items-center gap-2"
                            >
                                <Trash2 size={16} /> Purgar Entorno
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
