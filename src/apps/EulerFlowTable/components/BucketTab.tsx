import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Info, Settings, PanelLeftClose, PanelLeftOpen, ThermometerSun, ChevronDown, ChevronUp } from "lucide-react";
import { MathRender } from "../../../lib/MathRender";
import { pressureToViridisCSS } from "../../../lib/colormap";

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    age: number;
    size: number;
    color: string;
}

interface StreamlineParticle {
    x: number;
    y: number;
    t: number;
}

export default function BucketTab() {
    const [H, setH] = useState<number>(1.8); 
    const [hOrifice, setHOrifice] = useState<number>(1.2); 
    const [dOrifice, setDOrifice] = useState<number>(20); 
    const [g, setG] = useState<number>(9.81); 
    const [orificeType, setOrificeType] = useState<"sharp" | "short" | "rounded">("rounded");
    const [isDynamic, setIsDynamic] = useState<boolean>(false); 

    const [isPlaying, setIsPlaying] = useState<boolean>(true);
    const [showStreamlines, setShowStreamlines] = useState<boolean>(true);
    const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
    const [isPanelOpen, setIsPanelOpen] = useState<boolean>(true);
    const [isBottomOpen, setIsBottomOpen] = useState<boolean>(true);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const splashParticlesRef = useRef<Particle[]>([]);
    const tankParticlesRef = useRef<StreamlineParticle[]>([]);
    const animationFrameRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const currentHRef = useRef<number>(H); 

    const coefficients = {
        sharp: { Cd: 0.61, Cv: 0.97, name: "Borde Afilado" },
        short: { Cd: 0.82, Cv: 0.82, name: "Boquilla Corta cilindrica" },
        rounded: { Cd: 0.98, Cv: 0.98, name: "Borde Redondeado (Boquilla ideal)" }
    };

    const { Cd, Cv, name: orificeName } = coefficients[orificeType];

    useEffect(() => {
        if (!isDynamic) {
            currentHRef.current = H;
        }
    }, [H, isDynamic]);

    const handleRefill = () => {
        currentHRef.current = H;
        if (!isPlaying) renderFrame();
    };

    const initTankParticles = () => {
        const temp: StreamlineParticle[] = [];
        for (let i = 0; i < 40; i++) {
            temp.push({
                x: 100 + Math.random() * 120,
                y: 80 + Math.random() * 200,
                t: Math.random()
            });
        }
        tankParticlesRef.current = temp;
    };

    useEffect(() => {
        initTankParticles();
    }, []);

    const renderFrame = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) drawSimulation(ctx, canvas, 0);
        }
    };

    const drawSimulation = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, dt: number) => {
        const hVal = Math.max(0.01, currentHRef.current);
        const vTheoretical = Math.sqrt(2 * g * hVal);
        const vActual = Cv * vTheoretical;

        const areaOrifice = Math.PI * Math.pow(dOrifice / 1000, 2) / 4;
        const Q = Cd * areaOrifice * vTheoretical; 
        const tankArea = 4.0;

        if (isDynamic && isPlaying && dt > 0 && currentHRef.current > 0.02) {
            currentHRef.current = Math.max(0, currentHRef.current - (Q / tankArea) * dt);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#05070d";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const groundY = 380; 
        const tankLeftX = 100;
        const tankRightX = 220;
        const tankWidth = tankRightX - tankLeftX;
        const scalePxM = 90; 

        const orificeY = groundY - hOrifice * scalePxM;
        const waterTopY = orificeY - currentHRef.current * scalePxM;

        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(canvas.width, groundY);
        ctx.stroke();
        
        ctx.fillStyle = "rgba(30, 41, 59, 0.3)";
        ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

        // 1. DIBUJAR AGUA
        if (currentHRef.current > 0.01) {
            if (showHeatmap) {
                const blockSize = 4;
                const pMin = 101325; // 1 atm
                const rhoWater = 1000;
                const maxDepth = (groundY - waterTopY) / scalePxM;
                const pMax = pMin + rhoWater * g * maxDepth;

                for (let yG = waterTopY; yG < groundY; yG += blockSize) {
                    for (let xG = tankLeftX; xG < tankRightX; xG += blockSize) {
                        const depth = (yG - waterTopY) / scalePxM;
                        const pLocal = pMin + rhoWater * g * depth;
                        ctx.fillStyle = pressureToViridisCSS(pLocal, pMin, pMax, 0.85);
                        ctx.fillRect(xG, yG, blockSize, blockSize);
                    }
                }
            } else {
                const waterGrad = ctx.createLinearGradient(tankLeftX, waterTopY, tankLeftX, orificeY + 15);
                waterGrad.addColorStop(0, "rgba(14, 165, 233, 0.25)");
                waterGrad.addColorStop(1, "rgba(14, 165, 233, 0.65)");
                ctx.fillStyle = waterGrad;
                
                ctx.beginPath();
                ctx.moveTo(tankLeftX + 2, waterTopY);
                ctx.lineTo(tankRightX - 2, waterTopY);
                ctx.lineTo(tankRightX - 2, groundY - 2);
                ctx.lineTo(tankLeftX + 2, groundY - 2);
                ctx.closePath();
                ctx.fill();
            }

            // Ondulaciones
            ctx.strokeStyle = "rgba(34, 211, 238, 0.7)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(tankLeftX + 2, waterTopY);
            const timePhase = isPlaying ? (Date.now() / 250) : 0;
            for (let x = tankLeftX + 2; x <= tankRightX - 2; x += 4) {
                const waveY = waterTopY + Math.sin((x - tankLeftX) * 0.1 + timePhase) * 2;
                ctx.lineTo(x, waveY);
            }
            ctx.stroke();
        }

        // 2. PAREDES DE VIDRIO
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 4;
        ctx.lineCap = "square";
        ctx.beginPath();
        ctx.moveTo(tankLeftX, 60);
        ctx.lineTo(tankLeftX, groundY);
        ctx.lineTo(tankRightX, groundY);
        ctx.lineTo(tankRightX, orificeY + (dOrifice / 2));
        ctx.moveTo(tankRightX, orificeY - (dOrifice / 2));
        ctx.lineTo(tankRightX, 60);
        ctx.stroke();

        // 3. ANIMAR PARTÍCULAS INTERNAS
        if (currentHRef.current > 0.05 && isPlaying && dt > 0 && !showHeatmap) {
            tankParticlesRef.current.forEach((p) => {
                const dx = tankRightX - p.x;
                const dy = orificeY - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (p.y < waterTopY || dist < 6 || Math.random() < 0.005) {
                    p.x = tankLeftX + Math.random() * tankWidth;
                    p.y = waterTopY + Math.random() * 20;
                } else {
                    const speed = (vActual * 0.22) * Math.max(0.1, 15 / (dist + 5));
                    p.x += (dx / dist) * speed * dt * 40;
                    p.y += (dy / dist) * speed * dt * 40;
                    if (p.y < waterTopY) p.y = waterTopY;
                    if (p.x < tankLeftX) p.x = tankLeftX;
                    if (p.x > tankRightX) p.x = tankRightX;
                }

                ctx.fillStyle = "rgba(34, 211, 238, 0.35)";
                ctx.beginPath();
                ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // 4. CHORRO PARABÓLICO
        if (currentHRef.current > 0.02) {
            ctx.strokeStyle = showHeatmap ? "rgba(34, 211, 238, 0.4)" : "rgba(14, 165, 233, 0.85)";
            ctx.fillStyle = showHeatmap ? "rgba(34, 211, 238, 0.2)" : "rgba(14, 165, 233, 0.4)";
            ctx.lineWidth = dOrifice * 0.7; 

            ctx.beginPath();
            ctx.moveTo(tankRightX, orificeY);

            let jetT = 0;
            let jetX = tankRightX;
            let jetY = orificeY;
            const jetPoints: { x: number; y: number }[] = [];

            while (jetY < groundY && jetX < canvas.width) {
                jetPoints.push({ x: jetX, y: jetY });
                jetT += 0.015;
                jetX = tankRightX + vActual * jetT * scalePxM;
                jetY = orificeY + 0.5 * g * jetT * jetT * scalePxM;
            }
            if (jetX < canvas.width) {
                jetPoints.push({ x: jetX, y: groundY });
            }

            if (jetPoints.length > 1) {
                ctx.beginPath();
                ctx.moveTo(jetPoints[0].x, jetPoints[0].y);
                for (let i = 1; i < jetPoints.length; i++) {
                    ctx.lineTo(jetPoints[i].x, jetPoints[i].y);
                }
                ctx.stroke();
            }

            const lastPt = jetPoints[jetPoints.length - 1];
            if (lastPt && lastPt.x < canvas.width && !showHeatmap) {
                ctx.fillStyle = "#67e8f9";
                ctx.beginPath();
                ctx.ellipse(lastPt.x, groundY, 12, 3, 0, 0, Math.PI * 2);
                ctx.fill();

                if (isPlaying && dt > 0 && Math.random() < 0.8) {
                    for (let s = 0; s < 4; s++) {
                        splashParticlesRef.current.push({
                            x: lastPt.x,
                            y: groundY - 2,
                            vx: (Math.random() - 0.3) * 3,
                            vy: -(Math.random() * 4 + 2),
                            age: 0,
                            size: Math.random() * 2 + 1,
                            color: Math.random() < 0.5 ? "#22d3ee" : "#0284c7"
                        });
                    }
                }
            }

            if (showStreamlines) {
                ctx.strokeStyle = "rgba(16, 185, 129, 0.5)";
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                
                ctx.beginPath();
                ctx.moveTo(tankLeftX - 15, waterTopY);
                ctx.lineTo(tankLeftX - 15, orificeY);
                ctx.stroke();

                ctx.moveTo(tankLeftX - 25, waterTopY); ctx.lineTo(tankLeftX - 5, waterTopY);
                ctx.moveTo(tankLeftX - 25, orificeY); ctx.lineTo(tankLeftX - 5, orificeY);
                ctx.stroke();

                ctx.fillStyle = "#10b981";
                ctx.font = "bold 10px ui-monospace, monospace";
                ctx.fillText(`H = ${currentHRef.current.toFixed(2)} m`, tankLeftX - 85, (waterTopY + orificeY) / 2 + 4);

                ctx.beginPath();
                ctx.moveTo(tankLeftX - 15, orificeY);
                ctx.lineTo(tankLeftX - 15, groundY);
                ctx.stroke();
                ctx.moveTo(tankLeftX - 25, groundY); ctx.lineTo(tankLeftX - 5, groundY);
                ctx.stroke();

                ctx.fillText(`h_o = ${hOrifice.toFixed(2)} m`, tankLeftX - 85, (orificeY + groundY) / 2 + 4);
                
                ctx.setLineDash([]);

                const theoreticalRange = 2 * Math.sqrt(hVal * hOrifice);
                const rangeX = tankRightX + theoreticalRange * scalePxM;
                ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
                ctx.beginPath();
                ctx.moveTo(tankRightX, groundY + 12);
                ctx.lineTo(rangeX, groundY + 12);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(tankRightX, groundY + 7); ctx.lineTo(tankRightX, groundY + 17);
                ctx.moveTo(rangeX, groundY + 7); ctx.lineTo(rangeX, groundY + 17);
                ctx.stroke();

                ctx.fillStyle = "#f59e0b";
                ctx.fillText(`Alcance X_max = ${theoreticalRange.toFixed(2)} m`, (tankRightX + rangeX)/2 - 60, groundY + 28);
            }
        }

        if (isPlaying && dt > 0 && !showHeatmap) {
            splashParticlesRef.current.forEach((p) => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.25; 
                p.age += dt;

                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
            splashParticlesRef.current = splashParticlesRef.current.filter((p) => p.age < 0.6 && p.y <= groundY + 10);
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = 800;
        canvas.height = 430;

        const render = (time: number) => {
            const dt = lastTimeRef.current ? Math.min(0.03, (time - lastTimeRef.current) / 1000) : 0.016;
            lastTimeRef.current = time;

            drawSimulation(ctx, canvas, dt);

            if (isPlaying) {
                animationFrameRef.current = requestAnimationFrame(render);
            }
        };

        if (isPlaying) {
            animationFrameRef.current = requestAnimationFrame(render);
        } else {
            drawSimulation(ctx, canvas, 0);
        }

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [H, hOrifice, dOrifice, g, orificeType, isDynamic, isPlaying, showStreamlines, showHeatmap]);

    const hVal = Math.max(0.01, currentHRef.current);
    const vTheoretical = Math.sqrt(2 * g * hVal);
    const vActual = Cv * vTheoretical;
    const areaOrifice = Math.PI * Math.pow(dOrifice / 1000, 2) / 4;
    const Q = Cd * areaOrifice * vTheoretical;
    const QLps = Q * 1000;

    return (
        <div className="flex h-full w-full flex-col lg:flex-row bg-[#080b11] text-slate-100 relative overflow-hidden">
            <aside className={`flex-shrink-0 bg-slate-950 border-r border-white/10 transition-all duration-300 overflow-y-auto ${isPanelOpen ? "w-80" : "w-0 opacity-0 overflow-hidden"}`}>
                <div className="w-80 p-5 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                Descarga de Depósito
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
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-slate-300 uppercase tracking-wider">Altura Agua (<MathRender inline math="H" />)</span>
                                <span className="font-mono text-cyan-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-white/5">
                                    {H.toFixed(2)} m
                                </span>
                            </div>
                            <input type="range" min="0.3" max="3.0" step="0.05" value={H} disabled={isDynamic} onChange={(e) => setH(parseFloat(e.target.value))} className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-400 disabled:opacity-40" />
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-slate-300 uppercase tracking-wider">Altura Orificio (<MathRender inline math="h_o" />)</span>
                                <span className="font-mono text-cyan-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-white/5">
                                    {hOrifice.toFixed(2)} m
                                </span>
                            </div>
                            <input type="range" min="0.2" max="2.5" step="0.05" value={hOrifice} onChange={(e) => setHOrifice(parseFloat(e.target.value))} className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-400" />
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-slate-300 uppercase tracking-wider">Diámetro (<MathRender inline math="d" />)</span>
                                <span className="font-mono text-cyan-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-white/5">
                                    {dOrifice} mm
                                </span>
                            </div>
                            <input type="range" min="10" max="35" step="1" value={dOrifice} onChange={(e) => setDOrifice(parseInt(e.target.value))} className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-400" />
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-slate-300 uppercase tracking-wider">Gravedad (<MathRender inline math="g" />)</span>
                                <span className="font-mono text-cyan-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-white/5">
                                    {g.toFixed(2)} m/s²
                                </span>
                            </div>
                            <input type="range" min="1.6" max="25.0" step="0.1" value={g} onChange={(e) => setG(parseFloat(e.target.value))} className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-400" />
                        </div>

                        <div className="space-y-3">
                            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                Geometría del Orificio
                            </label>
                            <select value={orificeType} onChange={(e) => setOrificeType(e.target.value as any)} className="w-full bg-slate-900 border border-white/10 rounded-lg py-2 px-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500">
                                <option value="sharp">Borde Afilado (Cd = 0.61)</option>
                                <option value="short">Boquilla Corta (Cd = 0.82)</option>
                                <option value="rounded">Borde Redondeado (Cd = 0.98)</option>
                            </select>
                        </div>

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
                                    Presión Hidrostática
                                </span>
                                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${showHeatmap ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                                    <div className={`w-3 h-3 rounded-full bg-white transition-transform ${showHeatmap ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            </button>

                            <div className="space-y-2 mt-4">
                                <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-300">
                                    <input type="checkbox" checked={isDynamic} onChange={() => setIsDynamic(!isDynamic)} className="rounded border-slate-700 bg-slate-900 text-cyan-500" />
                                    Vaciar tanque (Dinámico)
                                </label>
                                {isDynamic && (
                                    <button onClick={handleRefill} className="w-full bg-cyan-500 text-slate-950 font-bold py-1.5 px-3 rounded text-[11px] hover:bg-cyan-400 mt-2 transition-colors">
                                        Rellenar Tanque
                                    </button>
                                )}
                                <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-300 mt-2">
                                    <input type="checkbox" checked={showStreamlines} onChange={() => setShowStreamlines(!showStreamlines)} className="rounded border-slate-700 bg-slate-900 text-cyan-500" />
                                    Mostrar cotas e indicadores
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-5 border-t border-white/5 flex gap-2">
                        <button onClick={() => setIsPlaying(!isPlaying)} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${isPlaying ? "bg-amber-500/10 text-amber-300 border border-amber-500/20" : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"}`}>
                            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                            {isPlaying ? "Pausar" : "Simular"}
                        </button>
                        <button onClick={() => { setH(1.8); setHOrifice(1.2); setDOrifice(20); setG(9.81); setOrificeType("rounded"); setIsDynamic(false); currentHRef.current = 1.8; initTankParticles(); }} className="p-2 border border-white/10 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <RotateCcw size={15} />
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col p-4 lg:p-6 overflow-hidden">
                <div className="relative w-full flex-1 min-h-0 flex flex-col rounded-xl border border-white/10 bg-slate-950/40 shadow-2xl transition-all duration-300">
                    <div className="flex-1 w-full relative flex items-center justify-center p-2 overflow-hidden">
                        <canvas ref={canvasRef} className="w-full h-full object-contain aspect-[8/4.3]" />
                        
                        <div className="absolute top-4 left-4 pointer-events-none">
                            <span className="text-[10px] uppercase font-bold tracking-widest bg-slate-900/90 text-cyan-400 px-2 py-1 rounded border border-white/10 backdrop-blur-sm">
                                Física de Descarga Libre (Torricelli)
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
                                    101325 Pa<br/>(Superficie)
                                </span>
                                <div className="flex-1 h-3 rounded-full border border-white/5 shadow-inner" style={{ background: "linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725)" }} />
                                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                    Alta Presión<br/>(Fondo)
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
                                Datos de la Descarga
                            </h3>
                            <div className="space-y-2 text-xs text-slate-300 font-mono">
                                <div className="flex justify-between items-center">
                                    <span>Orificio seleccionado:</span>
                                    <span className="text-white font-bold">{orificeName}</span>
                                </div>
                                <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                                    <span>Velocidad teórica (<MathRender inline math="v_t" />):</span>
                                    <span className="font-mono font-bold text-slate-200">{vTheoretical.toFixed(2)} m/s</span>
                                </div>
                                <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                                    <span>Velocidad real de salida (<MathRender inline math="v_s" />):</span>
                                    <span className="font-mono font-bold text-cyan-400">{vActual.toFixed(2)} m/s</span>
                                </div>
                                <div className="flex justify-between items-center py-1 mt-2">
                                    <span>Caudal de salida (<MathRender inline math="Q" />):</span>
                                    <span className="font-mono font-bold text-emerald-400">{QLps.toFixed(3)} L/s</span>
                                </div>
                                <div className="flex justify-between items-center py-1">
                                    <span>Área del orificio (<MathRender inline math="A" />):</span>
                                    <span className="font-mono text-slate-300">{(areaOrifice * 10000).toFixed(2)} cm²</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-950/60 border border-white/10 rounded-xl p-4">
                            <h3 className="text-sm font-bold text-slate-200 border-b border-white/5 pb-2 mb-3 flex items-center gap-2">
                                <Settings size={16} className="text-emerald-400" />
                                Formulación de Torricelli
                            </h3>
                            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
                                <p>
                                    1. **Teorema de Torricelli:** Derivado de Bernoulli asumiendo presiones atmosféricas en el chorro y la superficie:
                                </p>
                                <MathRender math="v_t = \sqrt{2gH}" className="text-cyan-300 text-center block my-1" />
                                <p>
                                    2. **Caudal Real:** Se reduce por la fricción (<MathRender inline math="C_v" />) y la contracción (<MathRender inline math="C_c" />), englobados en el coeficiente <MathRender inline math="C_d" />:
                                </p>
                                <MathRender math="Q_{\text{real}} = C_d \cdot A \cdot \sqrt{2gH}" className="text-emerald-400 text-center block my-1" />
                                <p className="text-[11px] text-slate-400">
                                    3. **Trayectoria:** El agua describe una parábola gobernada por caída libre. El alcance es <MathRender inline math="X = 2\sqrt{H \cdot h_o}" />.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
