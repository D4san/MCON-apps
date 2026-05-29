import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Info, Settings, PanelRightClose, PanelRightOpen, ThermometerSun, ChevronDown, ChevronUp } from "lucide-react";
import { MathRender } from "../../../lib/MathRender";
import { pressureToViridisCSS } from "../../../lib/colormap";

interface Particle {
    x: number;
    y: number;
    speedFactor: number;
    history: { x: number; y: number }[];
    age: number;
    streamlineIndex: number;
}

export default function PitotTab() {
    const [v0, setV0] = useState<number>(2.0); 
    const [workingFluid, setWorkingFluid] = useState<"water" | "air">("water");
    const [manometerFluid, setManometerFluid] = useState<"mercury" | "oil" | "water">("mercury");
    
    const [isPlaying, setIsPlaying] = useState<boolean>(true);
    const [showStreamlines, setShowStreamlines] = useState<boolean>(true);
    const [showParticles, setShowParticles] = useState<boolean>(true);
    const [showVelocities] = useState<boolean>(true);
    const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
    const [isPanelOpen, setIsPanelOpen] = useState<boolean>(true);
    const [isBottomOpen, setIsBottomOpen] = useState<boolean>(true);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const animationFrameRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);

    const g = 9.81;

    const rhoWorking = workingFluid === "water" ? 1000 : 1.2;
    
    useEffect(() => {
        if (workingFluid === "water" && manometerFluid !== "mercury") {
            setManometerFluid("mercury");
        } else if (workingFluid === "air" && manometerFluid === "mercury") {
            setManometerFluid("water");
        }
    }, [workingFluid, manometerFluid]);

    const rhoManometer = manometerFluid === "mercury" ? 13600 : manometerFluid === "oil" ? 850 : 1000;

    const deltaP = 0.5 * rhoWorking * v0 * v0; 
    
    const rhoDiff = rhoManometer - rhoWorking;
    const h = rhoDiff > 0 ? deltaP / (rhoDiff * g) : 0; 
    const hMm = h * 1000; 

    const numStreamlines = 9;
    const initParticles = () => {
        const temp: Particle[] = [];
        const canvas = canvasRef.current;
        const width = canvas ? canvas.width : 800;
        
        for (let i = 0; i < numStreamlines; i++) {
            const yStart = 80 + (i / (numStreamlines - 1)) * 140;
            for (let j = 0; j < 10; j++) {
                temp.push({
                    x: Math.random() * width,
                    y: yStart,
                    speedFactor: 1.0,
                    history: [],
                    age: Math.random() * 5,
                    streamlineIndex: i
                });
            }
        }
        particlesRef.current = temp;
    };

    const getVelocityAt = (x: number, y: number): { u: number; v: number; isInside: boolean; speed2: number } => {
        const cy = 150; 
        const R = 12;   
        const mouthX = 350;
        const stagX = 420;
        
        const insideHorizontal = x >= mouthX && x <= 540 && Math.abs(y - cy) <= R;
        const insideVertical = x >= 460 && x <= 540 && y >= 40 && y <= cy;
        
        if (insideHorizontal || insideVertical) {
            if (x >= mouthX && x < stagX && Math.abs(y - cy) <= R - 2) {
                const progress = (x - mouthX) / (stagX - mouthX);
                const u = v0 * Math.max(0, 1 - progress);
                return { u, v: 0, isInside: false, speed2: u*u };
            }
            return { u: 0, v: 0, isInside: true, speed2: 0 };
        }

        const cx = mouthX; 
        const dx = x - cx;
        const dy = y - cy;
        const r2 = dx*dx + dy*dy;

        if (x < mouthX) {
            if (Math.abs(dy) <= R - 2) {
                return { u: v0, v: 0, isInside: false, speed2: v0*v0 };
            }
            const safeR = Math.max(Math.sqrt(r2), R);
            const safeR2 = safeR * safeR;
            const cos2theta = (dx*dx - dy*dy) / safeR2;
            const sin2theta = (2*dx*dy) / safeR2;
            const R2_r2 = (R*R) / safeR2;
            
            let u = v0 * (1 - R2_r2 * cos2theta);
            let v = -v0 * R2_r2 * sin2theta;
            
            return { u, v, isInside: false, speed2: u*u + v*v };
        } else {
            const distWall = y < cy && insideVertical ? Math.abs(x - 500) : Math.abs(dy);
            if (y < cy && insideVertical && distWall <= 40) return { u: 0, v: 0, isInside: true, speed2: 0 };
            if (distWall <= R) return { u: 0, v: 0, isInside: true, speed2: 0 };
            
            const gap = distWall - R;
            const factor = 1 + Math.exp(-gap / 20) * 0.15; 
            return { u: v0 * factor, v: 0, isInside: false, speed2: v0*v0*factor*factor };
        }
    };

    useEffect(() => {
        initParticles();
    }, [v0, workingFluid]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = 800;
        canvas.height = 400;

        const render = (time: number) => {
            const dt = lastTimeRef.current ? Math.min(0.03, (time - lastTimeRef.current) / 1000) : 0.016;
            lastTimeRef.current = time;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (showHeatmap) {
                const blockSize = 4;
                const pMin = 101325; 
                const pMax = pMin + 0.5 * rhoWorking * v0 * v0;
                
                for(let yG = 50; yG < 250; yG += blockSize) {
                    for(let xG = 0; xG < canvas.width; xG += blockSize) {
                        const vel = getVelocityAt(xG, yG);
                        let pLocal = pMin;
                        
                        const insideHorizontal = xG >= 350 && xG <= 540 && Math.abs(yG - 150) <= 12;
                        const insideVertical = xG >= 460 && xG <= 540 && yG >= 40 && yG <= 150;
                        
                        if (insideHorizontal || insideVertical) {
                            pLocal = pMax - 0.5 * rhoWorking * vel.speed2;
                        } else if (!vel.isInside) {
                            pLocal = pMax - 0.5 * rhoWorking * vel.speed2;
                        }
                        
                        ctx.fillStyle = pressureToViridisCSS(pLocal, pMin, pMax, 0.7);
                        ctx.fillRect(xG, yG, blockSize, blockSize);
                    }
                }
            } else {
                ctx.fillStyle = "#05070d";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                const channelGrad = ctx.createLinearGradient(0, 50, 0, 250);
                channelGrad.addColorStop(0, "rgba(30, 41, 59, 0.15)");
                channelGrad.addColorStop(0.5, "rgba(14, 165, 233, 0.04)");
                channelGrad.addColorStop(1, "rgba(30, 41, 59, 0.15)");
                ctx.fillStyle = channelGrad;
                ctx.fillRect(0, 50, canvas.width, 200);
            }

            ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 50); ctx.lineTo(canvas.width, 50);
            ctx.moveTo(0, 250); ctx.lineTo(canvas.width, 250);
            ctx.stroke();

            if (showStreamlines && !showHeatmap) {
                ctx.strokeStyle = "rgba(14, 165, 233, 0.15)";
                ctx.lineWidth = 1;
                for (let i = 0; i < numStreamlines; i++) {
                    const yStart = 80 + (i / (numStreamlines - 1)) * 140;
                    ctx.beginPath();
                    let cx = 0;
                    let cy = yStart;
                    ctx.moveTo(cx, cy);
                    
                    while (cx < canvas.width) {
                        const step = 8;
                        const vel = getVelocityAt(cx, cy);
                        if (vel.isInside) {
                            cx += step;
                            continue;
                        }
                        const angle = Math.atan2(vel.v, vel.u);
                        cx += Math.cos(angle) * step;
                        cy += Math.sin(angle) * step;
                        ctx.lineTo(cx, cy);
                    }
                    ctx.stroke();
                }
            }

            if (showParticles && isPlaying) {
                particlesRef.current.forEach((p) => {
                    const vel = getVelocityAt(p.x, p.y);
                    
                    if (vel.isInside || p.x > canvas.width || p.y < 50 || p.y > 250) {
                        p.x = 0;
                        const yStart = 80 + (p.streamlineIndex / (numStreamlines - 1)) * 140;
                        p.y = yStart;
                        p.history = [];
                    } else {
                        p.x += vel.u * dt * 90;
                        p.y += vel.v * dt * 90;
                        
                        p.history.push({ x: p.x, y: p.y });
                        if (p.history.length > 12) p.history.shift();
                    }

                    if (p.history.length > 1) {
                        ctx.beginPath();
                        ctx.moveTo(p.history[0].x, p.history[0].y);
                        for (let k = 1; k < p.history.length; k++) {
                            ctx.lineTo(p.history[k].x, p.history[k].y);
                        }
                        ctx.strokeStyle = workingFluid === "water" ? "rgba(34, 211, 238, 0.22)" : "rgba(226, 232, 240, 0.15)";
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }

                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                    ctx.fillStyle = workingFluid === "water" ? "#22d3ee" : "#cbd5e1";
                    ctx.fill();
                });
            }

            // DIBUJAR LA SONDA DE PITOT (Soporte hacia ARRIBA)
            // 1. Manómetro en U (ARRIBA A LA DERECHA)
            const uLeft = 580;
            const uRight = 640;
            const uBottom = 120;
            const uTop = 40;
            const uRadius = (uRight - uLeft) / 2; 

            ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
            ctx.lineWidth = 14;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(uLeft, uTop);
            ctx.lineTo(uLeft, uBottom - uRadius);
            ctx.arc(uLeft + uRadius, uBottom - uRadius, uRadius, Math.PI, 0, true);
            ctx.lineTo(uRight, uTop);
            ctx.stroke();

            ctx.strokeStyle = showHeatmap ? "rgba(15, 23, 42, 0.7)" : "#05070d";
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(uLeft, uTop - 2);
            ctx.lineTo(uLeft, uBottom - uRadius);
            ctx.arc(uLeft + uRadius, uBottom - uRadius, uRadius, Math.PI, 0, true);
            ctx.lineTo(uRight, uTop - 2);
            ctx.stroke();

            const hScale = 180;
            const hPx = Math.min(30, h * hScale);
            const baseLevelY = 80;
            const levelLeftY = baseLevelY + hPx; // Estancamiento empuja hacia ABAJO
            const levelRightY = baseLevelY - hPx;

            ctx.strokeStyle = manometerFluid === "mercury" ? "#94a3b8" : manometerFluid === "oil" ? "#ef4444" : "#06b6d4";
            ctx.lineWidth = 10;
            ctx.lineCap = "butt";
            ctx.beginPath();
            ctx.moveTo(uLeft, levelLeftY);
            ctx.lineTo(uLeft, uBottom - uRadius);
            ctx.arc(uLeft + uRadius, uBottom - uRadius, uRadius, Math.PI, 0, true);
            ctx.lineTo(uRight, levelRightY);
            ctx.stroke();

            ctx.fillStyle = manometerFluid === "mercury" ? "#cbd5e1" : manometerFluid === "oil" ? "#fca5a5" : "#67e8f9";
            ctx.beginPath();
            ctx.arc(uLeft, levelLeftY, 5, 0, Math.PI * 2);
            ctx.arc(uRight, levelRightY, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(uLeft - 20, levelLeftY); ctx.lineTo(uRight + 20, levelLeftY);
            ctx.moveTo(uRight - 20, levelRightY); ctx.lineTo(uRight + 20, levelRightY);
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.strokeStyle = "#10b981";
            ctx.beginPath();
            ctx.moveTo(uRight + 15, levelRightY);
            ctx.lineTo(uRight + 15, levelLeftY);
            ctx.stroke();

            ctx.fillStyle = "#10b981";
            ctx.font = "bold 11px ui-monospace, monospace";
            ctx.fillText("h", uRight + 22, baseLevelY + 4);

            // 2. Estructura de la Sonda ABIERTA (SOPORTE ARRIBA)
            ctx.strokeStyle = "rgba(241, 245, 249, 0.85)";
            ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
            ctx.lineWidth = 3;
            ctx.lineJoin = "round";

            ctx.beginPath();
            ctx.moveTo(350, 138); // Borde abierto frontal superior
            ctx.lineTo(540, 138);
            ctx.lineTo(540, 40); // Sube
            ctx.lineTo(460, 40); // Izquierda
            ctx.lineTo(460, 162); // Baja
            ctx.lineTo(350, 162); // Borde abierto frontal inferior
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(350, 138);
            ctx.lineTo(540, 138);
            ctx.lineTo(540, 40);
            ctx.lineTo(460, 40);
            ctx.lineTo(460, 162);
            ctx.lineTo(350, 162);
            ctx.closePath();
            ctx.fill();

            // Canal interior estancamiento (cyan)
            ctx.strokeStyle = "rgba(34, 211, 238, 0.6)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(350, 150); // Boca
            ctx.lineTo(480, 150);
            ctx.lineTo(480, 20); // Sube
            ctx.lineTo(uLeft, 20); 
            ctx.lineTo(uLeft, uTop);
            ctx.stroke();

            // Toma estática (amarilla)
            ctx.strokeStyle = "rgba(250, 204, 21, 0.75)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(440, 138); // Arriba
            ctx.lineTo(440, 130);
            ctx.lineTo(520, 130);
            ctx.lineTo(520, 10);
            ctx.lineTo(uRight, 10);
            ctx.lineTo(uRight, uTop);
            ctx.moveTo(440, 162); // Abajo
            ctx.lineTo(440, 170);
            ctx.lineTo(520, 170);
            ctx.lineTo(520, 130); 
            ctx.stroke();

            ctx.fillStyle = "#f59e0b";
            ctx.beginPath();
            ctx.arc(440, 138, 2.5, 0, Math.PI * 2);
            ctx.arc(440, 162, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // 3. Punto de estancamiento (Dentro del tubo)
            ctx.save();
            ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
            ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(420, 150, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.fillStyle = "#ef4444";
            ctx.font = "bold 10px ui-sans-serif, system-ui";
            ctx.fillText("v = 0", 385, 153);
            ctx.restore();

            if (isPlaying) {
                animationFrameRef.current = requestAnimationFrame(render);
            }
        };

        if (isPlaying) {
            animationFrameRef.current = requestAnimationFrame(render);
        } else {
            render(0);
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [v0, workingFluid, manometerFluid, isPlaying, showStreamlines, showParticles, showVelocities, showHeatmap]);

    return (
        <div className="flex h-full w-full bg-[#080b11] text-slate-100 overflow-hidden relative">
            
            {/* Panel Principal */}
            <main className="flex-1 flex flex-col p-4 lg:p-6 overflow-hidden">
                <div className="relative w-full flex-1 min-h-0 flex flex-col rounded-xl border border-white/10 bg-slate-950/40 shadow-2xl transition-all duration-300">
                    <div className="flex-1 w-full relative flex items-center justify-center p-2 overflow-hidden">
                        <canvas ref={canvasRef} className="w-full h-full object-contain aspect-[8/4]" />
                        
                        <div className="absolute top-4 left-4 pointer-events-none flex gap-2">
                            <span className="text-[10px] uppercase font-bold tracking-widest bg-slate-900/90 text-cyan-400 px-2 py-1 rounded border border-white/10 backdrop-blur-sm">
                                Física Activa: Flujo Potencial + Pitot
                            </span>
                        </div>

                        {!isPanelOpen && (
                            <button 
                                onClick={() => setIsPanelOpen(true)}
                                className="absolute top-4 right-4 bg-slate-900/80 border border-white/10 text-slate-400 hover:text-white p-2 rounded-lg backdrop-blur shadow-xl transition-all hover:scale-105 z-10"
                            >
                                <PanelRightOpen size={18} />
                            </button>
                        )}

                        {showHeatmap && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-80 bg-slate-900/80 backdrop-blur border border-white/10 rounded-lg p-3 flex items-center gap-3 shadow-xl pointer-events-none">
                                <span className="text-[10px] text-slate-400 font-mono text-right shrink-0">
                                    101325 Pa<br/>(Estática)
                                </span>
                                <div className="flex-1 h-3 rounded-full border border-white/5 shadow-inner" style={{ background: "linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725)" }} />
                                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                    {(101325 + deltaP).toFixed(1)} Pa<br/>(Total)
                                </span>
                            </div>
                        )}
                        
                        {/* Botón Flotante para Colapsar el Panel Inferior */}
                        <button 
                            onClick={() => setIsBottomOpen(!isBottomOpen)}
                            className="absolute bottom-4 right-4 z-20 bg-slate-900/80 border border-white/10 text-slate-400 hover:text-white px-3 py-1.5 text-xs font-bold rounded-lg backdrop-blur shadow-xl transition-all hover:scale-105 flex items-center gap-2"
                        >
                            {isBottomOpen ? "Ocultar Datos" : "Mostrar Datos"}
                            {isBottomOpen ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
                        </button>
                    </div>
                </div>

                {/* Ecuaciones y Datos (Colapsable) */}
                <div className={`transition-all duration-500 ease-in-out overflow-y-auto ${isBottomOpen ? "max-h-[800px] mt-6 opacity-100" : "max-h-0 mt-0 opacity-0"}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
                        {/* Tarjeta de Lectura de Datos */}
                        <div className="bg-slate-950/60 border border-white/10 rounded-xl p-4 flex flex-col justify-between">
                            <h3 className="text-sm font-bold text-slate-200 border-b border-white/5 pb-2 mb-3 flex items-center gap-2">
                                <Info size={16} className="text-cyan-400" />
                                Variables e Indicadores
                            </h3>
                            <div className="space-y-2.5 text-xs text-slate-300 font-mono">
                                <div className="flex justify-between items-center">
                                    <span>Densidad de corriente (<MathRender inline math="\rho_f" />):</span>
                                    <span className="text-white font-bold">{rhoWorking.toFixed(1)} kg/m³</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>Densidad manométrica (<MathRender inline math="\rho_m" />):</span>
                                    <span className="text-white font-bold">{rhoManometer.toFixed(0)} kg/m³</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-white/5 pt-2">
                                    <span>Presión Estática local (<MathRender inline math="p_s" />):</span>
                                    <span className="text-slate-400">101325.0 Pa (1 atm)</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>Presión Estancamiento (<MathRender inline math="p_t" />):</span>
                                    <span className="text-cyan-300 font-bold">{(101325 + deltaP).toFixed(1)} Pa</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-white/5 pt-2">
                                    <span>Desnivel medido (<MathRender inline math="h" />):</span>
                                    <span className="text-emerald-400 font-bold font-sans text-sm">
                                        {hMm.toFixed(2)} mm
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Tarjeta de Explicación de Fórmulas */}
                        <div className="bg-slate-950/60 border border-white/10 rounded-xl p-4">
                            <h3 className="text-sm font-bold text-slate-200 border-b border-white/5 pb-2 mb-3 flex items-center gap-2">
                                <Settings size={16} className="text-emerald-400" />
                                Deducción Analítica
                            </h3>
                            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
                                <p>
                                    1. La ecuación de Bernoulli en la línea de corriente que choca con la punta:
                                </p>
                                <MathRender math="p_s + \frac{1}{2}\rho_f v_0^2 = p_t" className="text-cyan-300 text-center block my-1" />
                                <p>
                                    2. Al estancarse, la presión se eleva en <MathRender inline math="\Delta p = p_t - p_s" />:
                                </p>
                                <MathRender math={`\\Delta p = \\frac{1}{2}(${rhoWorking.toFixed(1)})(${v0.toFixed(2)})^2 = ${deltaP.toFixed(1)}\\text{ Pa}`} className="text-cyan-300 text-center block my-1" />
                                
                                <div className="bg-slate-900/40 p-2.5 rounded-lg border border-emerald-500/10 text-emerald-200 mt-3 font-mono">
                                    <span>Despejando <MathRender inline math="v_0" /> desde la altura <MathRender inline math="h" /> del manómetro:</span>
                                    <MathRender math={`v_0 = \\sqrt{ \\frac{2gh(\\rho_m - \\rho_f)}{\\rho_f} } = ${v0.toFixed(2)}\\text{ m/s}`} className="text-center mt-2 text-sm font-bold" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            
            {/* Panel de Control Lateral Ocultable */}
            <aside className={`flex-shrink-0 bg-slate-950 border-l border-white/10 transition-all duration-300 overflow-y-auto ${isPanelOpen ? "w-80" : "w-0 opacity-0 overflow-hidden"}`}>
                <div className="w-80 p-5 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                Controles
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">Configura las propiedades físicas</p>
                        </div>
                        <button 
                            onClick={() => setIsPanelOpen(false)}
                            className="text-slate-500 hover:text-white transition-colors"
                        >
                            <PanelRightClose size={18} />
                        </button>
                    </div>

                    <div className="space-y-6 flex-1">
                        <div className="space-y-3">
                            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                Fluido de la Corriente (<MathRender inline math="\rho_f" />)
                            </label>
                            <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-1.5 rounded-lg border border-white/5">
                                <button onClick={() => setWorkingFluid("water")} className={`py-1.5 rounded-md text-xs font-bold transition-all ${workingFluid === "water" ? "bg-cyan-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"}`}>Agua</button>
                                <button onClick={() => setWorkingFluid("air")} className={`py-1.5 rounded-md text-xs font-bold transition-all ${workingFluid === "air" ? "bg-cyan-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"}`}>Aire</button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-slate-300 uppercase tracking-wider">Velocidad (<MathRender inline math="v_0" />)</span>
                                <span className="font-mono text-cyan-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-white/5">{v0.toFixed(1)} m/s</span>
                            </div>
                            <input type="range" min="0.2" max="5.0" step="0.05" value={v0} onChange={(e) => setV0(parseFloat(e.target.value))} className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-400" />
                        </div>

                        <div className="space-y-3">
                            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                Líquido Manométrico (<MathRender inline math="\rho_m" />)
                            </label>
                            {workingFluid === "water" ? (
                                <div className="text-xs bg-slate-900/60 text-slate-300 border border-white/5 rounded-lg p-3 leading-relaxed">
                                    <span className="font-bold text-slate-100 block mb-1">Mercurio (Hg) fijado</span>
                                    Al medir agua se requiere Mercurio para no desbordar el tubo en U a altas velocidades.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-1.5 rounded-lg border border-white/5">
                                    <button onClick={() => setManometerFluid("water")} className={`py-1.5 rounded-md text-xs font-bold transition-all ${manometerFluid === "water" ? "bg-cyan-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"}`}>Agua</button>
                                    <button onClick={() => setManometerFluid("oil")} className={`py-1.5 rounded-md text-xs font-bold transition-all ${manometerFluid === "oil" ? "bg-cyan-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"}`}>Aceite</button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Renderizado Visual
                            </label>
                            <button onClick={() => setShowHeatmap(!showHeatmap)} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${showHeatmap ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-slate-800'}`}>
                                <span className="flex items-center gap-2 text-sm font-bold">
                                    <ThermometerSun size={16} className={showHeatmap ? "text-indigo-400" : ""} />
                                    Mapa de Calor (Presión)
                                </span>
                                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${showHeatmap ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                                    <div className={`w-3 h-3 rounded-full bg-white transition-transform ${showHeatmap ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            </button>

                            <div className="space-y-2 mt-4">
                                <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-300">
                                    <input type="checkbox" checked={showStreamlines} onChange={() => setShowStreamlines(!showStreamlines)} className="rounded border-slate-700 bg-slate-900 text-cyan-500" /> Líneas de corriente
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-300">
                                    <input type="checkbox" checked={showParticles} onChange={() => setShowParticles(!showParticles)} className="rounded border-slate-700 bg-slate-900 text-cyan-500" /> Partículas de masa
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-5 border-t border-white/5 flex gap-2">
                        <button onClick={() => setIsPlaying(!isPlaying)} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${isPlaying ? "bg-amber-500/10 text-amber-300 border border-amber-500/20" : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"}`}>
                            {isPlaying ? <Pause size={14} /> : <Play size={14} />} {isPlaying ? "Pausar" : "Animar"}
                        </button>
                        <button onClick={() => { setV0(2.0); initParticles(); }} className="p-2 border border-white/10 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><RotateCcw size={15} /></button>
                    </div>
                </div>
            </aside>
        </div>
    );
}
