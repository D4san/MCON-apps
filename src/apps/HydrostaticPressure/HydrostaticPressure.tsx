import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MousePointer2, Eraser, PenTool, GripHorizontal, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { cn } from '../../lib/utils';

// --- Constants & Types ---
const GRID_COLS = 30;
const GRID_ROWS = 20;
const FLUID_LEVEL_ROW = 5; // Default fluid level (row index from top)

type CellType = 'empty' | 'solid' | 'fluid';
type ToolMode = 'draw' | 'erase' | 'sensor';

interface Sensor {
    id: string;
    x: number; // Grid coordinates (can be fractional)
    y: number;
    color: string;
}

const FLUIDS = {
    water: { name: 'Agua', density: 1000, color: 'rgba(56, 189, 248, 0.6)' },
    oil: { name: 'Aceite', density: 800, color: 'rgba(250, 204, 21, 0.6)' },
    honey: { name: 'Miel', density: 1420, color: 'rgba(217, 119, 6, 0.8)' },
    mercury: { name: 'Mercurio', density: 13600, color: 'rgba(148, 163, 184, 0.9)' },
};

const GRAVITIES = {
    earth: { name: 'Tierra', g: 9.81 },
    moon: { name: 'Luna', g: 1.62 },
    mars: { name: 'Marte', g: 3.72 },
    jupiter: { name: 'Júpiter', g: 24.79 },
};

const ATM_PRESSURE = 101.325; // kPa

export default function HydrostaticPressure() {
    // --- State ---
    const [grid, setGrid] = useState<CellType[][]>(() => {
        const initialGrid = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill('empty'));
        // Create a basic U-shape container
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                if (c === 0 || c === GRID_COLS - 1 || r === GRID_ROWS - 1) {
                    initialGrid[r][c] = 'solid';
                }
            }
        }
        // Add a central block to make it a U-tube
        for (let r = 10; r < GRID_ROWS - 1; r++) {
            for (let c = 12; c < 18; c++) {
                initialGrid[r][c] = 'solid';
            }
        }
        return initialGrid;
    });

    const [fluidType, setFluidType] = useState<keyof typeof FLUIDS>('water');
    const [gravityType, setGravityType] = useState<keyof typeof GRAVITIES>('earth');
    const [isOpenAtmosphere, setIsOpenAtmosphere] = useState(true);
    const [toolMode, setToolMode] = useState<ToolMode>('sensor');
    const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(false);
    const [showPressureField, setShowPressureField] = useState(false);
    
    const [sensors, setSensors] = useState<Sensor[]>([
        { id: 's1', x: 5, y: 15, color: '#ef4444' }, // Red
        { id: 's2', x: 25, y: 15, color: '#22c55e' }  // Green
    ]);
    const [activeSensorId, setActiveSensorId] = useState<string | null>(null);

    // --- Draggable Panels State ---
    const [panelsPos, setPanelsPos] = useState({
        readings: { x: 16, y: 16 },
        tools: { x: typeof window !== 'undefined' ? window.innerWidth - 300 : 800, y: 16 },
        equation: { x: 16, y: typeof window !== 'undefined' ? window.innerHeight - 150 : 600 }
    });

    // Ensure panels stay within bounds on resize
    useEffect(() => {
        const handleResize = () => {
            setPanelsPos(prev => ({
                readings: {
                    x: Math.min(prev.readings.x, window.innerWidth - 250),
                    y: Math.min(prev.readings.y, window.innerHeight - 150)
                },
                tools: {
                    x: Math.min(prev.tools.x, window.innerWidth - 300),
                    y: Math.min(prev.tools.y, window.innerHeight - 400)
                },
                equation: {
                    x: Math.min(prev.equation.x, window.innerWidth - 250),
                    y: Math.min(prev.equation.y, window.innerHeight - 150)
                }
            }));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const [draggingPanel, setDraggingPanel] = useState<keyof typeof panelsPos | null>(null);
    const dragOffset = useRef({ x: 0, y: 0 });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const fluidLevelsRef = useRef<number[][]>(Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(0)));

    // --- Physics Logic ---
    
    // Flood fill to determine which empty cells contain fluid
    const calculateFluidGrid = useCallback((currentGrid: CellType[][]) => {
        const newGrid = currentGrid.map(row => [...row]);
        
        // 1. Clear existing fluid
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                if (newGrid[r][c] === 'fluid') newGrid[r][c] = 'empty';
            }
        }

        // 2. Find all valid fluid surface starting points (empty cells at FLUID_LEVEL_ROW)
        const queue: {r: number, c: number}[] = [];
        for (let c = 0; c < GRID_COLS; c++) {
            if (newGrid[FLUID_LEVEL_ROW][c] === 'empty') {
                queue.push({r: FLUID_LEVEL_ROW, c});
            }
        }

        // 3. Flood fill downwards and sideways
        while (queue.length > 0) {
            const {r, c} = queue.shift()!;
            
            if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) continue;
            if (newGrid[r][c] !== 'empty') continue;

            newGrid[r][c] = 'fluid';

            // Can flow down, left, right. (Water doesn't flow up above its surface level)
            queue.push({r: r + 1, c});
            queue.push({r, c: c - 1});
            queue.push({r, c: c + 1});
        }

        return newGrid;
    }, []);

    // Update fluid whenever grid changes
    useEffect(() => {
        setGrid(prev => calculateFluidGrid(prev));
    }, [calculateFluidGrid]); // Only run when calculateFluidGrid changes (which is never, but good practice)


    const getPressureAt = (x: number, y: number) => {
        // Convert grid coordinates to physical depth (let's say 1 cell = 0.5 meters)
        const METERS_PER_CELL = 0.5;
        
        // Check if sensor is in fluid
        const r = Math.floor(y);
        const c = Math.floor(x);
        
        let inFluid = false;
        if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
            inFluid = grid[r][c] === 'fluid';
        }

        const P0 = isOpenAtmosphere ? ATM_PRESSURE : 0;

        if (!inFluid) return P0;

        // Depth is distance from FLUID_LEVEL_ROW
        const depthCells = Math.max(0, y - FLUID_LEVEL_ROW);
        const h = depthCells * METERS_PER_CELL;
        
        const rho = FLUIDS[fluidType].density;
        const g = GRAVITIES[gravityType].g;

        // P = P0 + rho * g * h (Result in Pa, convert to kPa)
        const pressurePa = (P0 * 1000) + (rho * g * h);
        return pressurePa / 1000; // Return in kPa
    };

    // --- Canvas Rendering & Animation ---
    const stateRef = useRef({
        grid,
        sensors,
        fluidType,
        gravityType,
        isOpenAtmosphere,
        showPressureField
    });

    useEffect(() => {
        stateRef.current = { grid, sensors, fluidType, gravityType, isOpenAtmosphere, showPressureField };
    }, [grid, sensors, fluidType, gravityType, isOpenAtmosphere, showPressureField]);

    useEffect(() => {
        let animationId: number;

        const renderLoop = (time: number) => {
            const { grid, sensors, fluidType, gravityType, isOpenAtmosphere, showPressureField } = stateRef.current;
            const fluidLevels = fluidLevelsRef.current;

            // 1. Update fluid levels (Animation logic)
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    const target = grid[r][c] === 'fluid' ? 1 : 0;
                    const current = fluidLevels[r][c];
                    
                    if (target === 1 && current < 1) {
                        let canFill = false;
                        if (r === FLUID_LEVEL_ROW) canFill = true;
                        else if (r > 0 && fluidLevels[r-1][c] > 0.5) canFill = true;
                        else if (c > 0 && fluidLevels[r][c-1] > 0.8) canFill = true;
                        else if (c < GRID_COLS - 1 && fluidLevels[r][c+1] > 0.8) canFill = true;
                        else if (r < GRID_ROWS - 1 && fluidLevels[r+1][c] > 0.8) canFill = true;
                        
                        if (canFill) {
                            fluidLevels[r][c] = Math.min(1, current + 0.15); // Fill speed
                        }
                    } else if (target === 0 && current > 0) {
                        fluidLevels[r][c] = Math.max(0, current - 0.15); // Drain speed
                    }
                }
            }

            // 2. Draw
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (canvas && container) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Responsive sizing
                    const rect = container.getBoundingClientRect();
                    if (canvas.width !== rect.width || canvas.height !== rect.height) {
                        canvas.width = rect.width;
                        canvas.height = rect.height;
                    }

                    const cellW = canvas.width / GRID_COLS;
                    const cellH = canvas.height / GRID_ROWS;

                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    // Draw Grid Background
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                    ctx.lineWidth = 1;
                    for (let r = 0; r <= GRID_ROWS; r++) {
                        ctx.beginPath(); ctx.moveTo(0, r * cellH); ctx.lineTo(canvas.width, r * cellH); ctx.stroke();
                    }
                    for (let c = 0; c <= GRID_COLS; c++) {
                        ctx.beginPath(); ctx.moveTo(c * cellW, 0); ctx.lineTo(c * cellW, canvas.height); ctx.stroke();
                    }

                    // Draw Cells
                    for (let r = 0; r < GRID_ROWS; r++) {
                        for (let c = 0; c < GRID_COLS; c++) {
                            const cell = grid[r][c];
                            if (cell === 'solid') {
                                ctx.fillStyle = '#334155'; // slate-700
                                ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
                                
                                // Inner border for 3D effect
                                ctx.strokeStyle = '#475569'; // slate-600
                                ctx.strokeRect(c * cellW + 2, r * cellH + 2, cellW - 4, cellH - 4);
                            } else {
                                const level = fluidLevels[r][c];
                                if (level > 0) {
                                    if (showPressureField) {
                                        // Calculate pressure for color
                                        const depthCells = Math.max(0, r - FLUID_LEVEL_ROW);
                                        const maxDepth = GRID_ROWS - FLUID_LEVEL_ROW;
                                        // Hue from 220 (cyan) to 0 (red)
                                        const hue = 220 - (depthCells / maxDepth) * 220;
                                        ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${0.4 + level * 0.4})`;
                                    } else {
                                        // Base color with slight depth gradient
                                        const depth = (r - FLUID_LEVEL_ROW) / (GRID_ROWS - FLUID_LEVEL_ROW);
                                        ctx.fillStyle = FLUIDS[fluidType].color;
                                        ctx.globalAlpha = (0.5 + (depth * 0.5)) * level;
                                    }
                                    
                                    // Draw growing from bottom
                                    const h = cellH * level;
                                    const y = r * cellH + (cellH - h);
                                    
                                    // Add wave effect if it's a surface cell
                                    let waveOffset = 0;
                                    if (level >= 0.9 && (r === 0 || fluidLevels[r-1][c] < 0.1)) {
                                        waveOffset = Math.sin(time * 0.003 + c * 0.5) * (cellH * 0.15);
                                    }

                                    ctx.fillRect(c * cellW, y + waveOffset, cellW + 0.5, h - waveOffset + 0.5);
                                    ctx.globalAlpha = 1.0;
                                }
                            }
                        }
                    }

                    // Draw Fluid Surface Line
                    ctx.beginPath();
                    ctx.moveTo(0, FLUID_LEVEL_ROW * cellH);
                    ctx.lineTo(canvas.width, FLUID_LEVEL_ROW * cellH);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.setLineDash([5, 5]);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Draw Sensors
                    sensors.forEach(sensor => {
                        const px = sensor.x * cellW;
                        const py = sensor.y * cellH;

                        // Sensor Body
                        ctx.beginPath();
                        ctx.arc(px, py, 12, 0, Math.PI * 2);
                        ctx.fillStyle = sensor.color;
                        ctx.fill();
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 2;
                        ctx.stroke();

                        // Inner dot
                        ctx.beginPath();
                        ctx.arc(px, py, 4, 0, Math.PI * 2);
                        ctx.fillStyle = '#fff';
                        ctx.fill();

                        // Value Tag
                        // Calculate pressure using the same logic as getPressureAt
                        const METERS_PER_CELL = 0.5;
                        const sr = Math.floor(sensor.y);
                        const sc = Math.floor(sensor.x);
                        let inFluid = false;
                        if (sr >= 0 && sr < GRID_ROWS && sc >= 0 && sc < GRID_COLS) {
                            inFluid = grid[sr][sc] === 'fluid';
                        }
                        const P0 = isOpenAtmosphere ? ATM_PRESSURE : 0;
                        let pressure = P0;
                        if (inFluid) {
                            const depthCells = Math.max(0, sensor.y - FLUID_LEVEL_ROW);
                            const h = depthCells * METERS_PER_CELL;
                            const rho = FLUIDS[fluidType].density;
                            const g = GRAVITIES[gravityType].g;
                            const pressurePa = (P0 * 1000) + (rho * g * h);
                            pressure = pressurePa / 1000;
                        }

                        const text = `${pressure.toFixed(1)} kPa`;
                        ctx.font = 'bold 12px Inter, sans-serif';
                        const textWidth = ctx.measureText(text).width;
                        
                        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; // slate-900
                        ctx.beginPath();
                        ctx.roundRect(px + 15, py - 20, textWidth + 16, 24, 4);
                        ctx.fill();
                        
                        ctx.fillStyle = '#fff';
                        ctx.fillText(text, px + 23, py - 4);
                    });
                }
            }

            animationId = requestAnimationFrame(renderLoop);
        };

        animationId = requestAnimationFrame(renderLoop);
        return () => cancelAnimationFrame(animationId);
    }, []);

    // --- Interaction Handlers ---
    const handlePanelDragStart = (e: React.MouseEvent | React.TouchEvent, panel: keyof typeof panelsPos) => {
        e.stopPropagation();
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }
        
        setDraggingPanel(panel);
        dragOffset.current = {
            x: clientX - panelsPos[panel].x,
            y: clientY - panelsPos[panel].y
        };
    };

    const handleGlobalMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!draggingPanel) return;
        
        let clientX, clientY;
        if ('touches' in e) {
            clientX = (e as TouchEvent).touches[0].clientX;
            clientY = (e as TouchEvent).touches[0].clientY;
        } else {
            clientX = (e as MouseEvent).clientX;
            clientY = (e as MouseEvent).clientY;
        }

        setPanelsPos(prev => {
            // Different bounds for different panels
            let maxX = window.innerWidth - 250;
            let maxY = window.innerHeight - 150;
            
            if (draggingPanel === 'tools') {
                maxX = window.innerWidth - 300;
                maxY = window.innerHeight - 400; // Taller panel
            }

            return {
                ...prev,
                [draggingPanel]: {
                    x: Math.max(0, Math.min(maxX, clientX - dragOffset.current.x)),
                    y: Math.max(0, Math.min(maxY, clientY - dragOffset.current.y))
                }
            };
        });
    }, [draggingPanel]);

    const handleGlobalMouseUp = useCallback(() => {
        setDraggingPanel(null);
    }, []);

    useEffect(() => {
        if (draggingPanel) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
            window.addEventListener('touchmove', handleGlobalMouseMove, { passive: false });
            window.addEventListener('touchend', handleGlobalMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            window.removeEventListener('touchmove', handleGlobalMouseMove);
            window.removeEventListener('touchend', handleGlobalMouseUp);
        };
    }, [draggingPanel, handleGlobalMouseMove, handleGlobalMouseUp]);

    const getGridCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0, r: 0, c: 0 };
        
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        const px = clientX - rect.left;
        const py = clientY - rect.top;
        
        const cellW = canvas.width / GRID_COLS;
        const cellH = canvas.height / GRID_ROWS;

        return {
            x: px / cellW,
            y: py / cellH,
            c: Math.floor(px / cellW),
            r: Math.floor(py / cellH)
        };
    };

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        const { x, y, r, c } = getGridCoords(e);
        
        if (toolMode === 'sensor') {
            // Check if clicked on a sensor
            const clickedSensor = sensors.find(s => {
                const dx = s.x - x;
                const dy = s.y - y;
                return Math.sqrt(dx*dx + dy*dy) < 1.5; // Hit radius in grid units
            });

            if (clickedSensor) {
                setActiveSensorId(clickedSensor.id);
                isDrawingRef.current = true;
            }
        } else {
            isDrawingRef.current = true;
            applyTool(r, c);
        }
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current) return;
        
        const { x, y, r, c } = getGridCoords(e);

        if (toolMode === 'sensor' && activeSensorId) {
            // Constrain to grid bounds
            const clampedX = Math.max(0.5, Math.min(GRID_COLS - 0.5, x));
            const clampedY = Math.max(0.5, Math.min(GRID_ROWS - 0.5, y));
            
            setSensors(prev => prev.map(s => 
                s.id === activeSensorId ? { ...s, x: clampedX, y: clampedY } : s
            ));
        } else if (toolMode !== 'sensor') {
            applyTool(r, c);
        }
    };

    const handlePointerUp = () => {
        isDrawingRef.current = false;
        setActiveSensorId(null);
        // Recalculate fluid after drawing finishes
        if (toolMode !== 'sensor') {
            setGrid(prev => calculateFluidGrid(prev));
        }
    };

    const applyTool = (r: number, c: number) => {
        if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return;
        
        setGrid(prev => {
            const newGrid = prev.map(row => [...row]);
            if (toolMode === 'draw' && newGrid[r][c] !== 'solid') {
                newGrid[r][c] = 'solid';
            } else if (toolMode === 'erase' && newGrid[r][c] === 'solid') {
                newGrid[r][c] = 'empty';
            }
            return newGrid;
        });
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] w-full bg-slate-950 text-slate-200 overflow-hidden relative">
            
            {/* Main Simulation Area (Full Screen) */}
            <div className="flex-1 relative bg-slate-950 flex flex-col h-full w-full">
                
                {/* Left: Sensor Readings */}
                <div 
                    className="absolute z-20 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-2xl pointer-events-auto flex flex-col"
                    style={{ left: panelsPos.readings.x, top: panelsPos.readings.y }}
                >
                    <div 
                        className="flex items-center justify-between mb-3 cursor-grab active:cursor-grabbing"
                        onPointerDown={(e) => handlePanelDragStart(e, 'readings')}
                    >
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lecturas de Presión</h3>
                        <GripHorizontal size={14} className="text-slate-600" />
                    </div>
                    <div className="flex flex-col gap-3">
                        {sensors.map(s => (
                            <div key={s.id} className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]" style={{ backgroundColor: s.color, boxShadow: `0 0 10px ${s.color}80` }} />
                                <span className="font-mono text-lg font-bold text-white tracking-tight">
                                    {getPressureAt(s.x, s.y).toFixed(1)} <span className="text-sm text-slate-400 font-sans font-normal">kPa</span>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Right: Tools & Properties */}
                <div 
                    className="absolute z-20 flex flex-col gap-4 items-end pointer-events-auto"
                    style={{ left: panelsPos.tools.x, top: panelsPos.tools.y }}
                >
                    {/* Drag Handle for Tools Group */}
                    <div 
                        className="w-full flex justify-center bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-t-xl p-1 cursor-grab active:cursor-grabbing -mb-4 z-30"
                        onPointerDown={(e) => handlePanelDragStart(e, 'tools')}
                    >
                        <GripHorizontal size={14} className="text-slate-600" />
                    </div>
                    
                    {/* Drawing Tools */}
                    <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl rounded-tr-none p-2 shadow-2xl flex gap-1">
                        <button 
                            onClick={() => setToolMode('sensor')}
                            title="Mover Sensores"
                            className={cn("p-3 rounded-lg transition-all", toolMode === 'sensor' ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:bg-white/5 hover:text-white")}
                        >
                            <MousePointer2 size={20} />
                        </button>
                        <button 
                            onClick={() => setToolMode('draw')}
                            title="Dibujar Paredes"
                            className={cn("p-3 rounded-lg transition-all", toolMode === 'draw' ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:bg-white/5 hover:text-white")}
                        >
                            <PenTool size={20} />
                        </button>
                        <button 
                            onClick={() => setToolMode('erase')}
                            title="Borrar Paredes"
                            className={cn("p-3 rounded-lg transition-all", toolMode === 'erase' ? "bg-rose-500/20 text-rose-300" : "text-slate-400 hover:bg-white/5 hover:text-white")}
                        >
                            <Eraser size={20} />
                        </button>
                        <div className="w-px bg-white/10 mx-1 my-2" />
                        <button 
                            onClick={() => setShowPressureField(!showPressureField)}
                            title="Ver Campo de Presiones"
                            className={cn("p-3 rounded-lg transition-all", showPressureField ? "bg-purple-500/20 text-purple-300" : "text-slate-400 hover:bg-white/5 hover:text-white")}
                        >
                            <Layers size={20} />
                        </button>
                    </div>

                    {/* Physics Properties Dropdowns */}
                    <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl w-64 flex flex-col overflow-hidden transition-all duration-300">
                        <button 
                            onClick={() => setIsPropertiesCollapsed(!isPropertiesCollapsed)}
                            className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors border-b border-white/5"
                        >
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Propiedades</span>
                            {isPropertiesCollapsed ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
                        </button>
                        
                        <div className={cn("flex flex-col gap-4 p-4 transition-all duration-300 origin-top", isPropertiesCollapsed ? "h-0 p-0 opacity-0 scale-y-0" : "h-auto opacity-100 scale-y-100")}>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex justify-between">
                                <span>Fluido</span>
                                <span className="text-cyan-400 font-mono">{FLUIDS[fluidType].density} kg/m³</span>
                            </label>
                            <select 
                                value={fluidType}
                                onChange={(e) => setFluidType(e.target.value as keyof typeof FLUIDS)}
                                className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                            >
                                {Object.entries(FLUIDS).map(([key, data]) => (
                                    <option key={key} value={key}>{data.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex justify-between">
                                <span>Gravedad</span>
                                <span className="text-cyan-400 font-mono">{GRAVITIES[gravityType].g} m/s²</span>
                            </label>
                            <select 
                                value={gravityType}
                                onChange={(e) => setGravityType(e.target.value as keyof typeof GRAVITIES)}
                                className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                            >
                                {Object.entries(GRAVITIES).map(([key, data]) => (
                                    <option key={key} value={key}>{data.name}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={() => setIsOpenAtmosphere(!isOpenAtmosphere)}
                            className={cn(
                                "w-full flex items-center justify-between p-2.5 rounded-lg border transition-all mt-2",
                                isOpenAtmosphere 
                                    ? "bg-blue-500/10 border-blue-500/30 text-blue-300" 
                                    : "bg-slate-950/50 border-white/10 text-slate-400"
                            )}
                        >
                            <span className="text-xs font-medium">{isOpenAtmosphere ? 'Tanque Abierto' : 'Tanque Cerrado'}</span>
                            <div className={cn("w-7 h-3.5 rounded-full relative transition-colors", isOpenAtmosphere ? "bg-blue-500" : "bg-slate-600")}>
                                <div className={cn("absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all", isOpenAtmosphere ? "left-4" : "left-0.5")} />
                            </div>
                        </button>
                        </div>
                    </div>
                </div>

                {/* Equation Overlay */}
                <div 
                    className="absolute z-20 pointer-events-auto"
                    style={{ left: panelsPos.equation.x, top: panelsPos.equation.y }}
                >
                    <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-2xl flex flex-col">
                        <div 
                            className="flex justify-center mb-2 cursor-grab active:cursor-grabbing"
                            onPointerDown={(e) => handlePanelDragStart(e, 'equation')}
                        >
                            <GripHorizontal size={14} className="text-slate-600" />
                        </div>
                        <div className="text-center font-mono text-xl text-white tracking-wider">
                            P = P₀ + ρgh
                        </div>
                    </div>
                </div>

                {/* Canvas Container */}
                <div 
                    ref={containerRef} 
                    className={cn(
                        "flex-1 w-full h-full relative",
                        toolMode === 'draw' ? 'cursor-crosshair' : toolMode === 'erase' ? 'cursor-cell' : 'cursor-default'
                    )}
                    onMouseDown={handlePointerDown}
                    onMouseMove={handlePointerMove}
                    onMouseUp={handlePointerUp}
                    onMouseLeave={handlePointerUp}
                    onTouchStart={handlePointerDown}
                    onTouchMove={handlePointerMove}
                    onTouchEnd={handlePointerUp}
                >
                    <canvas 
                        ref={canvasRef} 
                        className="absolute inset-0 w-full h-full touch-none"
                    />
                </div>
            </div>
        </div>
    );
}