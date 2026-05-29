import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Info, TrendingUp, PanelLeftClose, PanelLeftOpen, ThermometerSun, ChevronDown, ChevronUp } from "lucide-react";
import { MathRender } from "../../../lib/MathRender";
import { pressureToViridisCSS } from "../../../lib/colormap";

interface Particle {
    x: number;
    yOffsetFraction: number; 
    history: { x: number; y: number }[];
}

export default function VenturiTab() {
    const [Q, setQ] = useState<number>(3.5); 
    const [dThroat, setDThroat] = useState<number>(30); 
    const [rho, setRho] = useState<number>(1000); 
    const [useLosses, setUseLosses] = useState<boolean>(true); 

    const [isPlaying, setIsPlaying] = useState<boolean>(true);
    const [showVelGraph, setShowVelGraph] = useState<boolean>(true);
    const [showParticles, setShowParticles] = useState<boolean>(true);
    const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
    const [isPanelOpen, setIsPanelOpen] = useState<boolean>(true);
    const [isBottomOpen, setIsBottomOpen] = useState<boolean>(true);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const animationFrameRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);

    const g = 9.81;
    const dInlet = 60; 

    const initParticles = () => {
        const temp: Particle[] = [];
        const numParticles = 120;
        for (let i = 0; i < numParticles; i++) {
            temp.push({
                x: Math.random() * 800,
                yOffsetFraction: (Math.random() * 2 - 1) * 0.85, 
                history: []
            });
        }
        particlesRef.current = temp;
    };

    const getDiameterAt = (x: number): number => {
        const xCenter = 400;
        const transitionWidth = 140; 
        const factor = Math.exp(-Math.pow(x - xCenter, 2) / Math.pow(transitionWidth, 2));
        return dInlet - (dInlet - dThroat) * factor;
    };

    const Q_m3s = Q / 1000;
    const area1 = Math.PI * Math.pow(dInlet / 1000, 2) / 4;
    const area2 = Math.PI * Math.pow(dThroat / 1000, 2) / 4;
    const v1 = Q_m3s / area1;
    const v2 = Q_m3s / area2;
    const deltaPPa = 0.5 * rho * (v2*v2 - v1*v1);
    const hLoss12 = useLosses ? 0.04 * (v2 * v2) / (2 * g) : 0;
    const hLoss23 = useLosses ? 0.18 * (v2 * v2) / (2 * g) : 0;

    useEffect(() => {
        initParticles();
    }, [Q, dThroat]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = 800;
        canvas.height = 460;

        const render = (time: number) => {
            const dt = lastTimeRef.current ? Math.min(0.03, (time - lastTimeRef.current) / 1000) : 0.016;
            lastTimeRef.current = time;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#05070d";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const centerY = 180;
            const pxScaleY = 1.6; 
            
            const x1 = 150; 
            const x2 = 400; 
            const x3 = 650; 
            
            // Constantes para el cálculo de presión del Heatmap
            const p1_static = 101325; // 1 atm
            const p_total_ideal = p1_static + 0.5 * rho * v1 * v1; 
            const pMin = p_total_ideal - 0.5 * rho * v2 * v2 - (useLosses ? rho * g * hLoss12 : 0);

            // 1. Dibujar el Tubo Venturi
            if (showHeatmap) {
                const blockSize = 4;
                for(let px = 0; px < canvas.width; px += blockSize) {
                    const localD = getDiameterAt(px);
                    const localR = (localD / 2) * pxScaleY;
                    const areaX = Math.PI * Math.pow(localD / 1000, 2) / 4;
                    const vX = Q_m3s / areaX;
                    
                    let localLoss = 0;
                    if (useLosses) {
                         if (px > x1 && px <= x2) localLoss = hLoss12 * ((px - x1)/(x2 - x1));
                         else if (px > x2) localLoss = hLoss12 + hLoss23 * ((px - x2)/(x3 - x2));
                    }
                    const pLocal = p_total_ideal - 0.5 * rho * vX * vX - (rho * g * localLoss);
                    
                    ctx.fillStyle = pressureToViridisCSS(pLocal, pMin, p_total_ideal, 0.7);
                    ctx.fillRect(px, centerY - localR, blockSize, localR * 2);
                }
            } else {
                ctx.beginPath();
                for (let x = 0; x <= canvas.width; x += 5) {
                    const r = (getDiameterAt(x) / 2) * pxScaleY;
                    if (x === 0) ctx.moveTo(x, centerY - r);
                    else ctx.lineTo(x, centerY - r);
                }
                for (let x = canvas.width; x >= 0; x -= 5) {
                    const r = (getDiameterAt(x) / 2) * pxScaleY;
                    ctx.lineTo(x, centerY + r);
                }
                ctx.closePath();
                
                const tubeGrad = ctx.createLinearGradient(0, centerY - 60, 0, centerY + 60);
                tubeGrad.addColorStop(0, "rgba(30, 41, 59, 0.2)");
                tubeGrad.addColorStop(0.5, "rgba(14, 165, 233, 0.04)");
                tubeGrad.addColorStop(1, "rgba(30, 41, 59, 0.2)");
                ctx.fillStyle = tubeGrad;
                ctx.fill();
            }

            // Bordes del tubo
            ctx.beginPath();
            for (let x = 0; x <= canvas.width; x += 5) {
                const r = (getDiameterAt(x) / 2) * pxScaleY;
                if (x === 0) ctx.moveTo(x, centerY - r);
                else ctx.lineTo(x, centerY - r);
            }
            ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
            ctx.lineWidth = 2.5;
            ctx.stroke();

            ctx.beginPath();
            for (let x = 0; x <= canvas.width; x += 5) {
                const r = (getDiameterAt(x) / 2) * pxScaleY;
                if (x === 0) ctx.moveTo(x, centerY + r);
                else ctx.lineTo(x, centerY + r);
            }
            ctx.stroke();

            // 2. Mover y Dibujar Partículas
            if (showParticles && isPlaying) {
                particlesRef.current.forEach((p) => {
                    const d = getDiameterAt(p.x);
                    const area = Math.PI * Math.pow(d / 1000, 2) / 4; 
                    const v = Q_m3s / area; 
                    const speedPx = v * 50; 
                    p.x += speedPx * dt;

                    if (p.x > canvas.width) {
                        p.x = 0;
                        p.history = [];
                    }

                    const localRadius = (d / 2) * pxScaleY;
                    const y = centerY + p.yOffsetFraction * localRadius;
                    
                    p.history.push({ x: p.x, y });
                    if (p.history.length > 8) p.history.shift();

                    if (p.history.length > 1) {
                        ctx.beginPath();
                        ctx.moveTo(p.history[0].x, p.history[0].y);
                        for (let k = 1; k < p.history.length; k++) {
                            ctx.lineTo(p.history[k].x, p.history[k].y);
                        }
                        ctx.strokeStyle = "rgba(34, 211, 238, 0.22)";
                        ctx.lineWidth = 1.2;
                        ctx.stroke();
                    }

                    ctx.beginPath();
                    ctx.arc(p.x, y, 1.8, 0, Math.PI * 2);
                    ctx.fillStyle = "#22d3ee";
                    ctx.fill();
                });
            }

            // 3. Cálculos de Piezómetros
            const d3 = getDiameterAt(x3);
            const v3 = Q_m3s / (Math.PI * Math.pow(d3 / 1000, 2) / 4);

            const maxV = 6.0 / 1000 / (Math.PI * Math.pow(20 / 1000, 2) / 4); 
            const maxKinetic = (maxV * maxV) / (2 * g);
            const visualScale = 100 / maxKinetic;
            const baseWaterHeightPx = 140; 
            
            const waterHeight1Px = baseWaterHeightPx - ((v1*v1)/(2*g)) * visualScale;
            const waterHeight2Px = baseWaterHeightPx - ((v2*v2)/(2*g)) * visualScale - (hLoss12 * visualScale);
            const waterHeight3Px = baseWaterHeightPx - ((v3*v3)/(2*g)) * visualScale - ((hLoss12 + hLoss23) * visualScale);

            const levels = [
                { x: x1, hPx: waterHeight1Px, title: "Entrada (1)" },
                { x: x2, hPx: Math.max(5, waterHeight2Px), title: "Garganta (2)" },
                { x: x3, hPx: Math.max(5, waterHeight3Px), title: "Salida (3)" }
            ];

            levels.forEach((lvl) => {
                const wallY = centerY - (getDiameterAt(lvl.x) / 2) * pxScaleY;
                const waterHeightPx = lvl.hPx;
                const colTopY = 40; 
                const waterLevelY = wallY - waterHeightPx;

                ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
                ctx.lineWidth = 6;
                ctx.lineCap = "square";
                ctx.beginPath();
                ctx.moveTo(lvl.x, wallY);
                ctx.lineTo(lvl.x, colTopY);
                ctx.stroke();

                ctx.strokeStyle = showHeatmap ? "rgba(15, 23, 42, 0.7)" : "#05070d";
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(lvl.x, wallY + 2);
                ctx.lineTo(lvl.x, colTopY);
                ctx.stroke();

                ctx.strokeStyle = "rgba(6, 182, 212, 0.72)";
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(lvl.x, wallY + 2);
                ctx.lineTo(lvl.x, Math.max(waterLevelY, colTopY));
                ctx.stroke();

                ctx.fillStyle = "#67e8f9";
                ctx.beginPath();
                ctx.arc(lvl.x, Math.max(waterLevelY, colTopY), 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = "#06b6d4";
                ctx.beginPath();
                ctx.arc(lvl.x, wallY, 3, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
                ctx.font = "8px ui-monospace, monospace";
                
                for (let yG = colTopY + 20; yG < wallY; yG += 10) {
                    ctx.beginPath();
                    ctx.moveTo(lvl.x - 6, yG);
                    ctx.lineTo(lvl.x - 4, yG);
                    ctx.stroke();
                }

                ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
                ctx.font = "bold 10px ui-sans-serif, system-ui";
                ctx.fillText(lvl.title, lvl.x - 30, colTopY - 10);
                
                ctx.fillStyle = "#06b6d4";
                ctx.fillText(`${(lvl.hPx).toFixed(1)} px`, lvl.x - 15, colTopY + 15);
            });

            ctx.strokeStyle = "rgba(239, 68, 68, 0.5)"; 
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.beginPath();
            levels.forEach((lvl, i) => {
                const wallY = centerY - (getDiameterAt(lvl.x) / 2) * pxScaleY;
                const waterLevelY = Math.max(wallY - lvl.hPx, 40);
                if (i === 0) ctx.moveTo(lvl.x, waterLevelY);
                else ctx.lineTo(lvl.x, waterLevelY);
            });
            ctx.stroke();
            ctx.setLineDash([]); 
            
            ctx.fillStyle = "#ef4444";
            ctx.font = "bold 10px ui-sans-serif, system-ui";
            const lastLvl = levels[levels.length - 1];
            ctx.fillText("Línea Piezométrica (h = p/γ)", lastLvl.x + 20, centerY - (getDiameterAt(lastLvl.x) / 2) * pxScaleY - lastLvl.hPx);

            // 4. Gráfico inferior de velocidad vs presión
            if (showVelGraph && !showHeatmap) {
                const graphY = 370;
                const graphH = 60;
                const graphX = 50;
                const graphW = 700;

                ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
                ctx.strokeRect(graphX, graphY, graphW, graphH);

                ctx.beginPath();
                ctx.strokeStyle = "#3b82f6";
                ctx.lineWidth = 2;
                
                for (let px = 0; px <= graphW; px += 2) {
                    const xWorld = (px / graphW) * canvas.width;
                    const localV = Q_m3s / (Math.PI * Math.pow(getDiameterAt(xWorld)/1000, 2) / 4);
                    let localLoss = 0;
                    if (useLosses) {
                        if (xWorld > x1 && xWorld <= x2) localLoss = hLoss12 * ((xWorld - x1)/(x2 - x1));
                        else if (xWorld > x2) localLoss = hLoss12 + hLoss23 * ((xWorld - x2)/(x3 - x2));
                    }
                    const localHPx = baseWaterHeightPx - ((localV*localV)/(2*g)) * visualScale - (localLoss * visualScale);
                    const py = graphY + graphH - (localHPx / baseWaterHeightPx) * graphH;

                    if (px === 0) ctx.moveTo(graphX + px, py);
                    else ctx.lineTo(graphX + px, py);
                }
                ctx.stroke();

                ctx.fillStyle = "#10b981";
                ctx.font = "bold 9px ui-sans-serif, system-ui";
                ctx.fillText(`Velocidad v(x) [Max: ${v2.toFixed(1)} m/s]`, graphX + 10, graphY - graphH + 15);

                ctx.fillStyle = "#3b82f6";
                ctx.fillText(`Presión h(x)`, graphX + 10, graphY + graphH - 10);
            }

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
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [Q, dThroat, rho, useLosses, isPlaying, showVelGraph, showParticles, showHeatmap]);

    return (
        <div className="flex h-full w-full bg-[#080b11] text-slate-100 overflow-hidden relative">
            
            {/* Panel Control Lateral Ocultable */}
            <aside className={`flex-shrink-0 bg-slate-950 border-r border-white/10 transition-all duration-300 overflow-y-auto ${isPanelOpen ? "w-80" : "w-0 opacity-0 overflow-hidden"}`}>
                <div className="w-80 p-5 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                Tubo de Venturi
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">Configura las propiedades físicas</p>
                        </div>
                        <button 
                            onClick={() => setIsPanelOpen(false)}
                            className="text-slate-500 hover:text-white transition-colors"
                        >
                            <PanelLeftClose size={18} />
                        </button>
                    </div>

                    <div className="space-y-6 flex-1">
                        {/* Caudal Q */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-slate-300 uppercase tracking-wider">Caudal (<MathRender inline math="Q" />)</span>
                                <span className="font-mono text-cyan-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-white/5">
                                    {Q.toFixed(1)} L/s
                                </span>
                            </div>
                            <input
                                type="range" min="1.0" max="6.0" step="0.1"
                                value={Q} onChange={(e) => setQ(parseFloat(e.target.value))}
                                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-400"
                            />
                        </div>

                        {/* Diámetro d2 */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-slate-300 uppercase tracking-wider">Garganta (<MathRender inline math="d_2" />)</span>
                                <span className="font-mono text-cyan-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-white/5">
                                    {dThroat} mm
                                </span>
                            </div>
                            <input
                                type="range" min="20" max="45" step="1"
                                value={dThroat} onChange={(e) => setDThroat(parseInt(e.target.value))}
                                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-400"
                            />
                        </div>

                        {/* Tipo de Fluido */}
                        <div className="space-y-3">
                            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                Fluido de Trabajo (<MathRender inline math="\rho" />)
                            </label>
                            <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-1.5 rounded-lg border border-white/5">
                                <button
                                    onClick={() => setRho(1000)}
                                    className={`py-1.5 rounded-md text-xs font-bold transition-all ${rho === 1000 ? "bg-cyan-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"}`}
                                >
                                    Agua
                                </button>
                                <button
                                    onClick={() => setRho(800)}
                                    className={`py-1.5 rounded-md text-xs font-bold transition-all ${rho === 800 ? "bg-cyan-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"}`}
                                >
                                    Queroseno
                                </button>
                            </div>
                        </div>

                        {/* Renderizado Visual */}
                        <div className="space-y-3">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Renderizado Visual
                            </label>
                            
                            <button
                                onClick={() => setShowHeatmap(!showHeatmap)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${showHeatmap ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-slate-800'}`}
                            >
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
                                    <input type="checkbox" checked={useLosses} onChange={() => setUseLosses(!useLosses)} className="rounded border-slate-700 bg-slate-900 text-cyan-500" />
                                    Activar fricción (Fluido Real)
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-300">
                                    <input type="checkbox" checked={showParticles} onChange={() => setShowParticles(!showParticles)} className="rounded border-slate-700 bg-slate-900 text-cyan-500" />
                                    Partículas en movimiento
                                </label>
                                {!showHeatmap && (
                                    <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-300">
                                        <input type="checkbox" checked={showVelGraph} onChange={() => setShowVelGraph(!showVelGraph)} className="rounded border-slate-700 bg-slate-900 text-cyan-500" />
                                        Mostrar gráfico de perfiles
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-5 border-t border-white/5 flex gap-2">
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${isPlaying ? "bg-amber-500/10 text-amber-300 border border-amber-500/20" : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"}`}
                        >
                            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                            {isPlaying ? "Pausar" : "Simular"}
                        </button>
                        <button
                            onClick={() => { setQ(3.5); setDThroat(30); setUseLosses(true); initParticles(); }}
                            className="p-2 border border-white/10 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                            <RotateCcw size={15} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Panel Principal */}
            <main className="flex-1 flex flex-col p-4 lg:p-6 overflow-hidden">
                <div className="relative w-full flex-1 min-h-0 flex flex-col rounded-xl border border-white/10 bg-slate-950/40 shadow-2xl transition-all duration-300">
                    <div className="flex-1 w-full relative flex items-center justify-center p-2 overflow-hidden">
                        <canvas ref={canvasRef} className="w-full h-full object-contain aspect-[8/4.6]" />
                        
                        <div className="absolute top-4 left-4 pointer-events-none">
                            <span className="text-[10px] uppercase font-bold tracking-widest bg-slate-900/90 text-cyan-400 px-2 py-1 rounded border border-white/10 backdrop-blur-sm">
                                Continuidad + Bernoulli 1D
                            </span>
                        </div>

                        {!isPanelOpen && (
                            <button 
                                onClick={() => setIsPanelOpen(true)}
                                className="absolute top-4 right-4 bg-slate-900/80 border border-white/10 text-slate-400 hover:text-white p-2 rounded-lg backdrop-blur shadow-xl transition-all hover:scale-105 z-10"
                            >
                                <PanelLeftOpen size={18} />
                            </button>
                        )}

                        {showHeatmap && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-80 bg-slate-900/80 backdrop-blur border border-white/10 rounded-lg p-3 flex items-center gap-3 shadow-xl pointer-events-none">
                                <span className="text-[10px] text-slate-400 font-mono text-right shrink-0">
                                    Baja Presión<br/>(Garganta)
                                </span>
                                <div className="flex-1 h-3 rounded-full border border-white/5 shadow-inner" style={{ background: "linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725)" }} />
                                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                    Alta Presión<br/>(Entrada)
                                </span>
                            </div>
                        )}

                        <button 
                            onClick={() => setIsBottomOpen(!isBottomOpen)}
                            className="absolute bottom-4 right-4 z-20 bg-slate-900/80 border border-white/10 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg backdrop-blur shadow-xl transition-all hover:scale-105 flex items-center gap-2 text-xs font-bold"
                        >
                            {isBottomOpen ? "Ocultar Datos" : "Mostrar Datos"}
                            {isBottomOpen ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
                        </button>
                    </div>
                </div>

                <div className={`transition-all duration-500 ease-in-out overflow-y-auto ${isBottomOpen ? "max-h-[800px] mt-6 opacity-100" : "max-h-0 mt-0 opacity-0"}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
                        <div className="bg-slate-950/60 border border-white/10 rounded-xl p-4 flex flex-col justify-between">
                            <h3 className="text-sm font-bold text-slate-200 border-b border-white/5 pb-2 mb-3 flex items-center gap-2">
                                <Info size={16} className="text-cyan-400" />
                                Variables del Sistema
                            </h3>
                            <div className="space-y-2 text-xs text-slate-300 font-mono">
                                <div className="flex justify-between items-center">
                                    <span>Velocidad de Entrada (<MathRender inline math="v_1" />):</span>
                                    <span className="text-white font-bold">{v1.toFixed(2)} m/s</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>Velocidad en Garganta (<MathRender inline math="v_2" />):</span>
                                    <span className="text-cyan-300 font-bold">{v2.toFixed(2)} m/s</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>Relación (<MathRender inline math="v_2/v_1" />):</span>
                                    <span className="text-cyan-300">{(v2/v1).toFixed(2)}x</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-white/5 pt-2">
                                    <span>Caída de presión ideal (<MathRender inline math="\Delta p_{12}" />):</span>
                                    <span className="text-rose-400 font-bold">{deltaPPa.toFixed(1)} Pa</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>Pérdidas totales por fricción:</span>
                                    <span className="text-amber-400 font-bold">
                                        {useLosses ? `${((hLoss12 + hLoss23)*100).toFixed(1)} cm` : "0.0 cm"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-950/60 border border-white/10 rounded-xl p-4">
                            <h3 className="text-sm font-bold text-slate-200 border-b border-white/5 pb-2 mb-3 flex items-center gap-2">
                                <TrendingUp size={16} className="text-emerald-400" />
                                Principios Físicos Ilustrados
                            </h3>
                            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
                                <p>
                                    1. **Ecuación de Continuidad:** El flujo es incompresible, al reducir el área la velocidad aumenta:
                                </p>
                                <MathRender math="Q = A_1 v_1 = A_2 v_2" className="text-cyan-300 text-center block my-1" />
                                <p>
                                    2. **Ecuación de Bernoulli:** Un aumento de velocidad implica una caída de la presión estática:
                                </p>
                                <MathRender math="\frac{p_1}{\gamma} + \frac{v_1^2}{2g} = \frac{p_2}{\gamma} + \frac{v_2^2}{2g} + h_{\text{loss}}" className="text-cyan-300 text-center block my-1" />
                                <p className="text-[11px] text-slate-400">
                                    3. **Efecto Venturi:** Esta diferencia de presiones se visualiza por la diferencia de nivel en los piezómetros (Línea Piezométrica roja).
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
