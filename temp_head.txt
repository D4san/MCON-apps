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
    { name: 'J\u00fapiter', g: 24.79 },
];
const GRAVITY_MIN = 0.5;
const GRAVITY_MAX = 28;

// --- Types ---
type ToolMode = 'draw' | 'erase' | 'sensor' | 'addWater' | 'removeWater';

interface Sensor {
    id: string;
    x: number;
    y: number;
    color: string;
}

interface WallForceVector {
    x: number;
    y: number;
    fx: number;
    fy: number;
    magnitude: number;
}

interface WallArrowTarget {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    magnitude: number;
}

interface BasinProfile {
    cells: Array<[number, number]>;
    rowCounts: Map<number, number>;
    sortedRows: number[]; // descending: bottom (highest row#) first
    capacity: number;
}

interface SimState {
    wallGrid: boolean[][];
    basinLabels: number[][];
    basinProfiles: BasinProfile[];
    waterVolumes: number[];
}

// --- Utility ---
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const distancePointToSegment = (
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number,
) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

// --- Basin computation ---

/** Identify connected regions of non-solid cells */
function computeBasins(wallGrid: boolean[][]): { labels: number[][]; profiles: BasinProfile[] } {
    const labels: number[][] = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(-1));
    const profiles: BasinProfile[] = [];

    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (wallGrid[r][c] || labels[r][c] !== -1) continue;
            const id = profiles.length;
            const cells: Array<[number, number]> = [];
            const rowCounts = new Map<number, number>();
            const queue: Array<[number, number]> = [[r, c]];
            labels[r][c] = id;

            while (queue.length > 0) {
                const [cr, cc] = queue.pop()!;
                cells.push([cr, cc]);
                rowCounts.set(cr, (rowCounts.get(cr) ?? 0) + 1);
                for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
                    const nr = cr + dr;
                    const nc = cc + dc;
                    if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
                    if (wallGrid[nr][nc] || labels[nr][nc] !== -1) continue;
                    labels[nr][nc] = id;
                    queue.push([nr, nc]);
                }
            }

            const sortedRows = [...rowCounts.keys()].sort((a, b) => b - a);
            profiles.push({ cells, rowCounts, sortedRows, capacity: cells.length });
        }
    }

    return { labels, profiles };
}

/**
 * Compute the Y coordinate of the water surface for a basin given its volume.
 * Water fills from bottom (highest row number) upward.
 * Returns a fractional Y in grid coordinates.  Values >= GRID_ROWS mean no visible water.
 */
function computeWaterSurface(profile: BasinProfile, volume: number): number {
    if (volume <= 0 || profile.sortedRows.length === 0) return GRID_ROWS + 1;
    let remaining = Math.min(volume, profile.capacity);

    for (const row of profile.sortedRows) {
        const count = profile.rowCounts.get(row)!;
        if (remaining >= count) {
            remaining -= count;
            if (remaining <= 0) return row; // surface at top edge of this row
        } else {
            return row + (1 - remaining / count); // fractional surface within this row
        }
    }
    // Basin fully filled
    return profile.sortedRows[profile.sortedRows.length - 1];
}

/**
 * When walls change, redistribute water volumes from old basins to new basins.
 * For each new basin cell, check how much water it held in the old state.
 */
function redistributeVolumes(
    newBasins: { labels: number[][]; profiles: BasinProfile[] },
    oldLabels: number[][],
    oldProfiles: BasinProfile[],
    oldVolumes: number[],
): number[] {
    const oldSurfaces = oldVolumes.map((v, i) =>
        i < oldProfiles.length ? computeWaterSurface(oldProfiles[i], v) : GRID_ROWS + 1,
    );
    const newVolumes = new Array(newBasins.profiles.length).fill(0);

    for (let bid = 0; bid < newBasins.profiles.length; bid++) {
        for (const [r, c] of newBasins.profiles[bid].cells) {
            const oldBid = oldLabels[r]?.[c];
            if (oldBid == null || oldBid === -1) continue;
            const surface = oldSurfaces[oldBid];
            if (surface >= r + 1) continue; // was above water
            if (surface <= r) {
                newVolumes[bid] += 1; // fully submerged
            } else {
                newVolumes[bid] += (r + 1 - surface); // partial
            }
        }
        newVolumes[bid] = Math.min(newVolumes[bid], newBasins.profiles[bid].capacity);
    }

    return newVolumes;
}

// --- Initial state ---

function createInitialWallGrid(): boolean[][] {
    const grid: boolean[][] = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(false));
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (c === 0 || c === GRID_COLS - 1 || r === GRID_ROWS - 1) grid[r][c] = true;
        }
    }
    // Central divider (full height, 1 cell wide)
    for (let r = 0; r < GRID_ROWS - 1; r++) {
        grid[r][15] = true;
    }
    return grid;
}

function createInitialState(): SimState {
    const wallGrid = createInitialWallGrid();
    const { labels, profiles } = computeBasins(wallGrid);
    const waterVolumes = profiles.map((profile) => {
        let vol = 0;
        for (const [r] of profile.cells) {
            if (r >= DEFAULT_FLUID_SURFACE) vol++;
        }
        return vol;
    });
    return { wallGrid, basinLabels: labels, basinProfiles: profiles, waterVolumes };
}

// --- Physics ---

function getGaugePressurePa(
    x: number, y: number,
    basinLabels: number[][],
    waterSurfaces: number[],
    gravity: number,
): number {
    const r = Math.floor(y);
    const c = Math.floor(x);
    if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return 0;
    const bid = basinLabels[r][c];
    if (bid === -1 || bid >= waterSurfaces.length) return 0;
    const surface = waterSurfaces[bid];
    if (y <= surface) return 0;
    return WATER_DENSITY * gravity * (y - surface) * METERS_PER_CELL;
}

function getPressureKPa(
    x: number, y: number,
    basinLabels: number[][],
    waterSurfaces: number[],
    gravity: number,
    isOpenAtmosphere: boolean,
): number {
    const p0 = isOpenAtmosphere ? ATM_PRESSURE : 0;
    return p0 + getGaugePressurePa(x, y, basinLabels, waterSurfaces, gravity) / 1000;
}

function buildWallForceVectors(
    wallGrid: boolean[][],
    basinLabels: number[][],
    waterSurfaces: number[],
    gravity: number,
): WallForceVector[] {
    const vectors: WallForceVector[] = [];
    const dirs: ReadonlyArray<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (!wallGrid[r][c]) continue;
            for (const [dr, dc] of dirs) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
                if (wallGrid[nr][nc]) continue;
                const pressure = getGaugePressurePa(nc + 0.5, nr + 0.5, basinLabels, waterSurfaces, gravity);
                if (pressure <= 0) continue;
                const force = pressure * WALL_FACE_AREA;
                vectors.push({
                    x: nc + 0.5,
                    y: nr + 0.5,
                    fx: -dc * force,
                    fy: -dr * force,
                    magnitude: force,
                });
            }
        }
    }
    return vectors;
}

// ============================================================
// Component
// ============================================================

export default function HydrostaticPressure() {
    const [simState, setSimState] = useState<SimState>(createInitialState);
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
    const lastWaterCellRef = useRef('');
    const lastCellRef = useRef<{ r: number; c: number } | null>(null);
    const fluidLevelsRef = useRef<number[][]>(
        Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(0)),
    );
    const wallArrowTargetsRef = useRef<WallArrowTarget[]>([]);
    const [hoveredForce, setHoveredForce] = useState<{ x: number; y: number; magnitude: number } | null>(null);

    // Derived: water surface Y per basin (continuous / fractional)
    const waterSurfaces = useMemo(
        () =>
            simState.waterVolumes.map((vol, i) =>
                i < simState.basinProfiles.length
                    ? computeWaterSurface(simState.basinProfiles[i], vol)
                    : GRID_ROWS + 1,
            ),
        [simState.waterVolumes, simState.basinProfiles],
    );

    // State ref for render loop (avoids re-creating the effect)
    const stateRef = useRef({
        wallGrid: simState.wallGrid,
        basinLabels: simState.basinLabels,
        waterSurfaces,
        sensors,
        gravity,
        isOpenAtmosphere,
        showPressureField,
        showWallForces,
    });
    useEffect(() => {
        stateRef.current = {
            wallGrid: simState.wallGrid,
            basinLabels: simState.basinLabels,
            waterSurfaces,
            sensors,
            gravity,
            isOpenAtmosphere,
            showPressureField,
            showWallForces,
        };
    }, [simState, waterSurfaces, sensors, gravity, isOpenAtmosphere, showPressureField, showWallForces]);

    // Wall force summary for info panel
    const wallForceSummary = useMemo(() => {
        const vectors = buildWallForceVectors(simState.wallGrid, simState.basinLabels, waterSurfaces, gravity);
        const fx = vectors.reduce((acc, v) => acc + v.fx, 0);
        const fy = vectors.reduce((acc, v) => acc + v.fy, 0);
        return {
            count: vectors.length,
            total: Math.sqrt(fx * fx + fy * fy),
            max: vectors.reduce((acc, v) => Math.max(acc, v.magnitude), 0),
        };
    }, [simState.wallGrid, simState.basinLabels, waterSurfaces, gravity]);

    const getPressureAt = useCallback(
        (x: number, y: number) => getPressureKPa(x, y, simState.basinLabels, waterSurfaces, gravity, isOpenAtmosphere),
        [simState.basinLabels, waterSurfaces, gravity, isOpenAtmosphere],
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

    // --- Tool application ---
    const applyTool = useCallback(
        (r: number, c: number) => {
            if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return;

            // Dedup water tools per cell during a single stroke
            if (toolMode === 'addWater' || toolMode === 'removeWater') {
                const key = `${r},${c}`;
                if (lastWaterCellRef.current === key) return;
                lastWaterCellRef.current = key;
            }

            setSimState((prev) => {
                if (toolMode === 'draw') {
                    if (prev.wallGrid[r][c]) return prev;
                    const newWall = prev.wallGrid.map((row) => [...row]);
                    newWall[r][c] = true;
                    const nb = computeBasins(newWall);
                    const nv = redistributeVolumes(nb, prev.basinLabels, prev.basinProfiles, prev.waterVolumes);
                    return { wallGrid: newWall, basinLabels: nb.labels, basinProfiles: nb.profiles, waterVolumes: nv };
                }

                if (toolMode === 'erase') {
                    if (!prev.wallGrid[r][c]) return prev;
                    if (r === GRID_ROWS - 1 || c === 0 || c === GRID_COLS - 1) return prev;
                    const newWall = prev.wallGrid.map((row) => [...row]);
                    newWall[r][c] = false;
                    const nb = computeBasins(newWall);
                    const nv = redistributeVolumes(nb, prev.basinLabels, prev.basinProfiles, prev.waterVolumes);
                    return { wallGrid: newWall, basinLabels: nb.labels, basinProfiles: nb.profiles, waterVolumes: nv };
                }

                if (toolMode === 'addWater') {
                    const bid = prev.basinLabels[r][c];
                    if (bid === -1) return prev;
                    const nv = [...prev.waterVolumes];
                    nv[bid] = Math.min(prev.basinProfiles[bid].capacity, nv[bid] + 5);
                    return { ...prev, waterVolumes: nv };
                }

                if (toolMode === 'removeWater') {
                    const bid = prev.basinLabels[r][c];
                    if (bid === -1) return prev;
                    const nv = [...prev.waterVolumes];
                    nv[bid] = Math.max(0, nv[bid] - 5);
                    return { ...prev, waterVolumes: nv };
                }

                return prev;
            });
        },
        [toolMode],
    );

    // --- Pointer handlers ---
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

    // Bresenham line: returns all cells between (r0,c0) and (r1,c1)
    const bresenhamLine = useCallback((r0: number, c0: number, r1: number, c1: number) => {
        const cells: Array<{ r: number; c: number }> = [];
        let dr = Math.abs(r1 - r0);
        let dc = Math.abs(c1 - c0);
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

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        const { x, y, r, c } = getGridCoords(e);
        lastWaterCellRef.current = '';
        lastCellRef.current = { r, c };

        if (toolMode === 'sensor') {
            const clicked = sensors.find((s) => Math.hypot(s.x - x, s.y - y) < 1.5);
            if (clicked) {
                setActiveSensorId(clicked.id);
                isDrawingRef.current = true;
            }
            return;
        }
        isDrawingRef.current = true;
        applyTool(r, c);
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        const isTouch = 'touches' in e;
        const { x, y, r, c } = getGridCoords(e);

        // Hover tooltip for force arrows
        if (!isTouch && showWallForces) {
            const canvas = canvasRef.current;
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                const px = x * (canvas.width / GRID_COLS);
                const py = y * (canvas.height / GRID_ROWS);
                const bestHit = wallArrowTargetsRef.current.reduce<{ target: WallArrowTarget | null; dist: number }>(
                    (acc, target) => {
                        const dist = distancePointToSegment(px, py, target.startX, target.startY, target.endX, target.endY);
                        return dist < acc.dist ? { target, dist } : acc;
                    },
                    { target: null, dist: Number.POSITIVE_INFINITY },
                );
                if (bestHit.target && bestHit.dist <= 10) {
                    setHoveredForce({
                        x: clamp(('clientX' in e ? e.clientX : 0) - rect.left + 14, 8, rect.width - 70),
                        y: clamp(('clientY' in e ? e.clientY : 0) - rect.top - 18, 8, rect.height - 24),
                        magnitude: bestHit.target.magnitude,
                    });
                } else {
                    setHoveredForce(null);
                }
            }
        } else {
            setHoveredForce(null);
        }

        if (!isDrawingRef.current) return;

        if (toolMode === 'sensor' && activeSensorId) {
            setSensors((prev) =>
                prev.map((s) =>
                    s.id === activeSensorId
                        ? { ...s, x: clamp(x, 0.5, GRID_COLS - 0.5), y: clamp(y, 0.5, GRID_ROWS - 0.5) }
                        : s,
                ),
            );
            lastCellRef.current = { r, c };
            return;
        }

        // Interpolate from last cell to current cell so fast drags don't leave gaps
        const prev = lastCellRef.current;
        if (prev && (prev.r !== r || prev.c !== c)) {
            const cells = bresenhamLine(prev.r, prev.c, r, c);
            // Skip first cell (already applied)
            for (let i = 1; i < cells.length; i++) {
                applyTool(cells[i].r, cells[i].c);
            }
        } else {
            applyTool(r, c);
        }
        lastCellRef.current = { r, c };
    };

    const handlePointerUp = () => {
        isDrawingRef.current = false;
        setActiveSensorId(null);
        lastWaterCellRef.current = '';
        lastCellRef.current = null;
    };

    // Clear all walls and water except border walls
    const handleClearAll = useCallback(() => {
        const wallGrid: boolean[][] = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(false));
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                if (c === 0 || c === GRID_COLS - 1 || r === GRID_ROWS - 1) wallGrid[r][c] = true;
            }
        }
        const { labels, profiles } = computeBasins(wallGrid);
        const waterVolumes = new Array(profiles.length).fill(0);
        setSimState({ wallGrid, basinLabels: labels, basinProfiles: profiles, waterVolumes });
    }, []);

    // ============================================================
    // Render loop
    // ============================================================
    useEffect(() => {
        let animationId = 0;

        const drawArrow = (
            ctx: CanvasRenderingContext2D,
            x1: number, y1: number,
            x2: number, y2: number,
            color: string, width: number,
        ) => {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) return;
            const ux = dx / len;
            const uy = dy / len;
            const head = Math.max(4, Math.min(9, len * 0.35));

            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = width;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - ux * head - uy * head * 0.5, y2 - uy * head + ux * head * 0.5);
            ctx.lineTo(x2 - ux * head + uy * head * 0.5, y2 - uy * head - ux * head * 0.5);
            ctx.closePath();
            ctx.fill();
        };

        const renderLoop = (time: number) => {
            const {
                wallGrid: curWall,
                basinLabels: curLabels,
                waterSurfaces: curSurfaces,
                sensors: curSensors,
                gravity: curGravity,
                isOpenAtmosphere: curOpen,
                showPressureField: curShowPressure,
                showWallForces: curShowForces,
            } = stateRef.current;

            const fluidLevels = fluidLevelsRef.current;

            // Animate fill levels toward physics targets
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    let fillTarget = 0;
                    if (!curWall[r][c]) {
                        const bid = curLabels[r][c];
                        if (bid !== -1 && bid < curSurfaces.length) {
                            const surface = curSurfaces[bid];
                            if (surface <= r) {
                                fillTarget = 1;
                            } else if (surface < r + 1) {
                                fillTarget = r + 1 - surface;
                            }
                        }
                    }
                    const cur = fluidLevels[r][c];
                    if (cur < fillTarget) {
                        fluidLevels[r][c] = Math.min(fillTarget, cur + 0.12);
                    } else if (cur > fillTarget) {
                        fluidLevels[r][c] = Math.max(fillTarget, cur - 0.15);
                    }
                }
            }

            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) {
                animationId = requestAnimationFrame(renderLoop);
                return;
            }
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                animationId = requestAnimationFrame(renderLoop);
                return;
            }

            const rect = container.getBoundingClientRect();
            if (canvas.width !== rect.width || canvas.height !== rect.height) {
                canvas.width = rect.width;
                canvas.height = rect.height;
            }

            const cellW = canvas.width / GRID_COLS;
            const cellH = canvas.height / GRID_ROWS;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Grid lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            for (let r = 0; r <= GRID_ROWS; r++) {
                ctx.beginPath();
                ctx.moveTo(0, r * cellH);
                ctx.lineTo(canvas.width, r * cellH);
                ctx.stroke();
            }
            for (let c = 0; c <= GRID_COLS; c++) {
                ctx.beginPath();
                ctx.moveTo(c * cellW, 0);
                ctx.lineTo(c * cellW, canvas.height);
                ctx.stroke();
            }

            // Cells: solid + fluid
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    // Solid
                    if (curWall[r][c]) {
                        ctx.fillStyle = '#334155';
                        ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
                        ctx.strokeStyle = '#475569';
                        ctx.strokeRect(c * cellW + 1.5, r * cellH + 1.5, cellW - 3, cellH - 3);
                        continue;
                    }

                    const level = fluidLevels[r][c];
                    if (level <= 0.001) continue;

                    const bid = curLabels[r][c];
                    if (bid === -1) continue;

                    // Color by depth
                    if (curShowPressure) {
                        const surface = curSurfaces[bid];
                        const depthCells = Math.max(0, r + 0.5 - surface);
                        const maxDepth = Math.max(1, GRID_ROWS - surface);
                        const hue = 220 - (depthCells / maxDepth) * 220;
                        ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${0.4 + level * 0.45})`;
                    } else {
                        const surface = curSurfaces[bid];
                        const normalDepth = Math.max(0, r + 0.5 - surface) / Math.max(1, GRID_ROWS - surface);
                        ctx.fillStyle = WATER_COLOR;
                        ctx.globalAlpha = (0.5 + normalDepth * 0.5) * level;
                    }

                    const h = cellH * level;
                    const y = r * cellH + (cellH - h);

                    // Wave on surface cells
                    let waveOffset = 0;
                    if (level > 0.05 && level < 0.98) {
                        waveOffset = Math.sin(time * 0.003 + c * 0.45) * (cellH * 0.07 * level);
                    } else if (level >= 0.9 && (r === 0 || fluidLevels[r - 1][c] < 0.1)) {
                        waveOffset = Math.sin(time * 0.003 + c * 0.45) * (cellH * 0.12);
                    }

                    ctx.fillRect(c * cellW, y + waveOffset, cellW + 0.5, h - waveOffset + 0.5);
                    ctx.globalAlpha = 1;
                }
            }

            // Wall force arrows
            const wallVectors = buildWallForceVectors(curWall, curLabels, curSurfaces, curGravity);
            wallArrowTargetsRef.current = [];

            if (curShowForces && wallVectors.length > 0) {
                const sorted = [...wallVectors].sort((a, b) => b.magnitude - a.magnitude).slice(0, 120);
                const maxForce = sorted[0]?.magnitude ?? 1;

                sorted.forEach((vector) => {
                    const ux = vector.fx / vector.magnitude;
                    const uy = vector.fy / vector.magnitude;
                    const len = cellW * (0.2 + 0.65 * (vector.magnitude / maxForce));

                    const startX = (vector.x + ux * 0.35) * cellW;
                    const startY = (vector.y + uy * 0.35) * cellH;
                    const endX = startX + ux * len;
                    const endY = startY + uy * len;

                    drawArrow(ctx, startX, startY, endX, endY, 'rgba(251, 146, 60, 0.92)', 1.4);
                    wallArrowTargetsRef.current.push({ startX, startY, endX, endY, magnitude: vector.magnitude });
                });
            }

            // Water surface dashed line (per column)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
            ctx.setLineDash([6, 6]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let c = 0; c < GRID_COLS; c++) {
                for (let r = 0; r < GRID_ROWS; r++) {
                    if (curWall[r][c]) continue;
                    const bid = curLabels[r][c];
                    if (bid === -1 || bid >= curSurfaces.length) break;
                    const surface = curSurfaces[bid];
                    if (surface >= GRID_ROWS) break; // no water
                    // Only draw in columns where the surface Y is reachable
                    if (surface >= r && surface < GRID_ROWS) {
                        const py = surface * cellH;
                        ctx.moveTo(c * cellW, py);
                        ctx.lineTo((c + 1) * cellW, py);
                    }
                    break;
                }
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // Sensors
            curSensors.forEach((sensor) => {
                const px = sensor.x * cellW;
                const py = sensor.y * cellH;

                ctx.beginPath();
                ctx.arc(px, py, 12, 0, Math.PI * 2);
                ctx.fillStyle = sensor.color;
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(px, py, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#fff';
                ctx.fill();

                const pressure = getPressureKPa(
                    sensor.x, sensor.y,
                    curLabels, curSurfaces,
                    curGravity, curOpen,
                );

                const label = `${pressure.toFixed(1)} kPa`;
                ctx.font = '700 12px ui-sans-serif, sans-serif';
                const textWidth = ctx.measureText(label).width;

                ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
                ctx.beginPath();
                ctx.roundRect(px + 15, py - 20, textWidth + 16, 24, 4);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.fillText(label, px + 23, py - 4);
            });

            animationId = requestAnimationFrame(renderLoop);
        };

        animationId = requestAnimationFrame(renderLoop);
        return () => cancelAnimationFrame(animationId);
    }, []);

    // ============================================================
    // JSX – Controls
    // ============================================================

    const controls = (
        <>
            <div className="space-y-1.5">
                <div className="flex gap-1.5 justify-center bg-slate-950/50 p-1.5 rounded-xl border border-white/5">
                    <button
                        onClick={() => setToolMode('sensor')}
                        aria-label="Mover sensores"
                        className={cn(
                            'p-2.5 rounded-lg transition-colors flex-1 flex flex-col items-center gap-0.5',
                            toolMode === 'sensor' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
                        )}
                    >
                        <MousePointer2 className="w-4 h-4" />
                        <span className="text-[8px] leading-none">Mover</span>
                    </button>
                    <button
                        onClick={() => setToolMode('draw')}
                        aria-label="Dibujar paredes"
                        className={cn(
                            'p-2.5 rounded-lg transition-colors flex-1 flex flex-col items-center gap-0.5',
                            toolMode === 'draw' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white'
                        )}
                    >
                        <PenTool className="w-4 h-4" />
                        <span className="text-[8px] leading-none">Pared</span>
                    </button>
                    <button
                        onClick={() => setToolMode('erase')}
                        aria-label="Borrar paredes"
                        className={cn(
                            'p-2.5 rounded-lg transition-colors flex-1 flex flex-col items-center gap-0.5',
                            toolMode === 'erase' ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-white'
                        )}
                    >
                        <Eraser className="w-4 h-4" />
                        <span className="text-[8px] leading-none">Borrar</span>
                    </button>
                </div>
                <div className="flex gap-1.5 justify-center bg-slate-950/50 p-1.5 rounded-xl border border-white/5">
                    <button
                        onClick={() => setToolMode('addWater')}
                        aria-label="A\u00f1adir agua"
                        className={cn(
                            'p-2.5 rounded-lg transition-colors flex-1 flex flex-col items-center gap-0.5',
                            toolMode === 'addWater' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-white'
                        )}
                    >
                        <Plus className="w-4 h-4" />
                        <span className="text-[8px] leading-none">Agua</span>
                    </button>
                    <button
                        onClick={() => setToolMode('removeWater')}
                        aria-label="Quitar agua"
                        className={cn(
                            'p-2.5 rounded-lg transition-colors flex-1 flex flex-col items-center gap-0.5',
                            toolMode === 'removeWater' ? 'bg-sky-500/20 text-sky-200' : 'text-slate-400 hover:text-white'
                        )}
                    >
                        <Minus className="w-4 h-4" />
                        <span className="text-[8px] leading-none">Quitar</span>
                    </button>
                    <button
                        onClick={() => setShowPressureField((v) => !v)}
                        aria-label="Ver mapa de presiones"
                        className={cn(
                            'p-2.5 rounded-lg transition-colors flex-1 flex flex-col items-center gap-0.5',
                            showPressureField ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400 hover:text-white'
                        )}
                    >
                        <Layers className="w-4 h-4" />
                        <span className="text-[8px] leading-none">Presi&#243;n</span>
                    </button>
                </div>
                <button
                    onClick={handleClearAll}
                    aria-label="Limpiar todo"
                    className="w-full p-2 rounded-lg transition-colors bg-slate-950/50 border border-white/5 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center gap-1.5"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="text-[9px] leading-none font-medium">Limpiar todo</span>
                </button>
            </div>

            <div className="space-y-3">
                {/* Gravity slider */}
                <div className="space-y-2 rounded-lg border border-white/10 bg-slate-950/40 p-3">
                    <div className="flex items-center justify-between text-[11px] font-semibold tracking-wide text-slate-300">
                        <span>Gravedad</span>
                        <span className="font-mono text-cyan-300">
                            {gravity.toFixed(2)} m/s&#178;
                            {closestGravityRef && <span className="text-slate-500 ml-1">({closestGravityRef.name})</span>}
                        </span>
                    </div>
                    <input
                        type="range"
                        min={GRAVITY_MIN}
                        max={GRAVITY_MAX}
                        step={0.01}
                        value={gravity}
                        onChange={(e) => setGravity(Number(e.target.value))}
                        className="w-full accent-cyan-400"
                        aria-label="Gravedad"
                    />
                    <div className="relative h-6">
                        {GRAVITY_REFS.map((ref) => {
                            const pct = ((ref.g - GRAVITY_MIN) / (GRAVITY_MAX - GRAVITY_MIN)) * 100;
                            return (
                                <button
                                    key={ref.name}
                                    onClick={() => setGravity(ref.g)}
                                    className="absolute flex flex-col items-center -translate-x-1/2 hover:text-cyan-400 transition-colors cursor-pointer text-slate-500"
                                    style={{ left: `${pct}%` }}
                                    title={`${ref.name}: ${ref.g} m/s\u00b2`}
                                >
                                    <span className="block w-px h-1.5 bg-current mb-0.5" />
                                    <span className="text-[9px] leading-none whitespace-nowrap">{ref.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <button
                    onClick={() => setIsOpenAtmosphere((v) => !v)}
                    className={cn(
                        'w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors',
                        isOpenAtmosphere
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                            : 'bg-slate-950/50 border-white/10 text-slate-400'
                    )}
                    aria-pressed={isOpenAtmosphere}
                >
                    <span className="text-xs sm:text-sm font-medium">{isOpenAtmosphere ? 'Tanque abierto' : 'Tanque cerrado'}</span>
                    <div className={cn('w-8 h-4 rounded-full relative transition-colors', isOpenAtmosphere ? 'bg-blue-500' : 'bg-slate-600')}>
                        <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-[left]', isOpenAtmosphere ? 'left-4.5' : 'left-0.5')} />
                    </div>
                </button>

                <div className="grid grid-cols-1 gap-2">
                    <button
                        onClick={() => setShowWallForces((v) => !v)}
                        className={cn(
                            'w-full rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                            showWallForces
                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-100'
                                : 'bg-slate-950/50 border-white/10 text-slate-300 hover:text-white'
                        )}
                        aria-pressed={showWallForces}
                    >
                        {showWallForces ? 'Ocultar fuerzas en paredes' : 'Mostrar fuerzas en paredes'}
                    </button>
                </div>

                <div className="text-center font-mono text-lg text-white tracking-wider pt-2 border-t border-white/10 mt-1">
                    P = P&#8320; + &#961;gh
                </div>
            </div>
        </>
    );

    // ============================================================
    // JSX – Layout
    // ============================================================
    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] w-full bg-slate-950 text-slate-200 overflow-hidden relative">
            <div className="flex-1 relative bg-slate-950 flex flex-col h-full w-full">
                {/* Info panel */}
                <div
                    className={cn(
                        'absolute z-20 bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-xl p-3 sm:p-4 shadow-2xl pointer-events-auto flex flex-col max-w-[250px]',
                        'top-4 left-4'
                    )}
                >
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Lecturas y fuerzas</h3>
                    <div className="flex flex-col gap-2 sm:gap-3">
                        {sensors.map((sensor) => (
                            <div key={sensor.id} className="flex items-center gap-2 sm:gap-3">
                                <div
                                    className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                                    style={{ backgroundColor: sensor.color, boxShadow: `0 0 10px ${sensor.color}80` }}
                                />
                                <span className="font-mono text-base sm:text-lg font-bold text-white tracking-tight">
                                    {getPressureAt(sensor.x, sensor.y).toFixed(1)}{' '}
                                    <span className="text-xs sm:text-sm text-slate-400 font-sans font-normal">kPa</span>
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 border-t border-white/10 pt-2 space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-300">
                            <span>Fuerza total pared</span>
                            <span className="font-mono text-amber-200">{(wallForceSummary.total / 1000).toFixed(1)} kN</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400">
                            <span>Contactos</span>
                            <span className="font-mono">{wallForceSummary.count}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400">
                            <span>Pico local</span>
                            <span className="font-mono">{(wallForceSummary.max / 1000).toFixed(1)} kN</span>
                        </div>
                    </div>
                </div>

                {/* Mobile menu button */}
                {isPortrait && (
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="absolute top-4 right-4 z-30 p-3 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl text-slate-300 hover:text-white transition-colors"
                        aria-label="Abrir configuracion"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                )}

                {/* Mobile menu */}
                {isPortrait && isMobileMenuOpen && (
                    <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end pointer-events-auto">
                        <div className="bg-slate-900 border-t border-white/10 rounded-t-2xl p-4 flex flex-col gap-4 animate-in slide-in-from-bottom-full duration-300 max-h-[88vh] overflow-auto">
                            <div className="flex justify-between items-center mb-1">
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Herramientas</h3>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 text-slate-400 hover:text-white transition-colors"
                                    aria-label="Cerrar menu"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            {controls}
                        </div>
                    </div>
                )}

                {/* Desktop sidebar */}
                {!isPortrait && (
                    <div className="absolute top-4 right-4 z-20 w-72 bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden pointer-events-auto">
                        <button
                            onClick={() => setIsPropertiesCollapsed((v) => !v)}
                            className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors border-b border-white/5"
                        >
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controles</span>
                            {isPropertiesCollapsed ? (
                                <ChevronDown size={14} className="text-slate-400" />
                            ) : (
                                <ChevronUp size={14} className="text-slate-400" />
                            )}
                        </button>
                        <div className={cn('p-4 transition-all duration-300', isPropertiesCollapsed ? 'hidden' : 'block')}>
                            {controls}
                        </div>
                    </div>
                )}

                {/* Canvas area */}
                <div
                    ref={containerRef}
                    className={cn(
                        'flex-1 w-full h-full relative',
                        toolMode === 'draw'
                            ? 'cursor-crosshair'
                            : toolMode === 'erase' || toolMode === 'addWater' || toolMode === 'removeWater'
                                ? 'cursor-cell'
                                : 'cursor-default'
                    )}
                    onMouseDown={handlePointerDown}
                    onMouseMove={handlePointerMove}
                    onMouseUp={handlePointerUp}
                    onMouseLeave={handlePointerUp}
                    onTouchStart={handlePointerDown}
                    onTouchMove={handlePointerMove}
                    onTouchEnd={handlePointerUp}
                >
                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none" />
                    {hoveredForce && (
                        <div
                            className="absolute pointer-events-none z-30 rounded-md border border-amber-400/30 bg-slate-900/95 px-2 py-1 text-[10px] text-amber-100 font-mono"
                            style={{ left: hoveredForce.x, top: hoveredForce.y }}
                        >
                            {(hoveredForce.magnitude / 1000).toFixed(2)} kN
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
