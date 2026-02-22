import React, { useState, useEffect, useRef, useCallback } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Play, Pause, RotateCcw, MousePointer2, Activity, Settings, X } from 'lucide-react';
import { useIsPortrait } from '../../hooks/useIsPortrait';

// --- Types ---
type FlowType = 'Uniforme' | 'Rotación Sólida' | 'Cizalladura' | 'Estancamiento' | 'Vórtice Puntual' | 'Expansión Radial' | 'Espiral' | 'Onda de Compresión' | 'Oscilante';

interface Parameter {
    val: number;
    min: number;
    max: number;
    step: number;
    name?: string;
}

interface FlowDefinition {
    vx: (x: number, y: number, t: number, p: any) => number;
    vy: (x: number, y: number, t: number, p: any) => number;
    div: (x: number, y: number, t: number, p: any) => number;
    params: { [key: string]: Parameter };
    equation: string;
    divEquation: string;
}

interface Particle {
    x: number;
    y: number;
    history: {x: number, y: number}[];
    age: number;
    lifetime: number;
    alpha: number;
    rho: number;
    isFollowed?: boolean;
}

// --- Constants ---
const FLOWS: { [key in FlowType]: FlowDefinition } = {
    'Uniforme': { 
        vx: (_x, _y, _t, p) => p.U, 
        vy: (_x, _y, _t, _p) => 0, 
        div: (_x, _y, _t, _p) => 0, 
        params: { U: { val: 1, min: -5, max: 5, step: 0.1 } }, 
        equation: '\\vec{v} = (U, 0)', 
        divEquation: '\\nabla \\cdot \\vec{v} = 0' 
    },
    'Rotación Sólida': { 
        vx: (_x, y, _t, p) => -p.Omega * y, 
        vy: (x, _y, _t, p) => p.Omega * x, 
        div: (_x, _y, _t, _p) => 0, 
        params: { Omega: { val: 1, min: -3, max: 3, step: 0.1, name: 'Ω' } }, 
        equation: '\\vec{v} = (-\\Omega y, \\Omega x)', 
        divEquation: '\\nabla \\cdot \\vec{v} = 0' 
    },
    'Cizalladura': { 
        vx: (_x, y, _t, p) => p.k * y, 
        vy: (_x, _y, _t, _p) => 0, 
        div: (_x, _y, _t, _p) => 0, 
        params: { k: { val: 1, min: -3, max: 3, step: 0.1 } }, 
        equation: '\\vec{v} = (ky, 0)', 
        divEquation: '\\nabla \\cdot \\vec{v} = 0' 
    },
    'Estancamiento': { 
        vx: (x, _y, _t, p) => p.a * x, 
        vy: (_x, y, _t, p) => -p.a * y, 
        div: (_x, _y, _t, _p) => 0, 
        params: { a: { val: 1, min: -3, max: 3, step: 0.1 } }, 
        equation: '\\vec{v} = (ax, -ay)', 
        divEquation: '\\nabla \\cdot \\vec{v} = 0' 
    },
    'Vórtice Puntual': { 
        vx: (x, y, _t, p) => { const r2 = x*x+y*y; return r2 < 1e-4 ? 0 : -p.Gamma*y/(2*Math.PI*r2); }, 
        vy: (x, y, _t, p) => { const r2 = x*x+y*y; return r2 < 1e-4 ? 0 : p.Gamma*x/(2*Math.PI*r2); }, 
        div: (_x, _y, _t, _p) => 0, 
        params: { Gamma: { val: 5, min: -10, max: 10, step: 0.5, name: 'Γ' } }, 
        equation: '\\vec{v} = \\frac{\\Gamma}{2\\pi r^2}(-y, x)', 
        divEquation: '\\nabla \\cdot \\vec{v} = 0 \\quad (r \\neq 0)' 
    },
    'Expansión Radial': { 
        vx: (x, _y, _t, p) => p.k * x, 
        vy: (_x, y, _t, p) => p.k * y, 
        div: (_x, _y, _t, p) => 2 * p.k, 
        params: { k: { val: 0.5, min: -2, max: 2, step: 0.1 } }, 
        equation: '\\vec{v} = (kx, ky)', 
        divEquation: '\\nabla \\cdot \\vec{v} = 2k' 
    },
    'Espiral': { 
        vx: (x, y, _t, p) => p.a * x - p.b * y, 
        vy: (x, y, _t, p) => p.b * x + p.a * y, 
        div: (_x, _y, _t, p) => 2 * p.a, 
        params: { a: { val: 0.2, min: -1, max: 1, step: 0.05 }, b: { val: 1, min: -3, max: 3, step: 0.1 } }, 
        equation: '\\vec{v} = (ax-by, bx+ay)', 
        divEquation: '\\nabla \\cdot \\vec{v} = 2a' 
    },
    'Onda de Compresión': { 
        vx: (x, _y, _t, p) => p.A * Math.sin(p.k * x), 
        vy: (_x, _y, _t, _p) => 0, 
        div: (x, _y, _t, p) => p.A * p.k * Math.cos(p.k * x), 
        params: { A: { val: 1, min: -2, max: 2, step: 0.1 }, k: { val: 1, min: 0.1, max: 5, step: 0.1 } }, 
        equation: '\\vec{v} = (A \\sin(kx), 0)', 
        divEquation: '\\nabla \\cdot \\vec{v} = Ak \\cos(kx)' 
    },
    'Oscilante': { 
        vx: (_x, _y, t, p) => p.A * Math.sin(p.omega * t), 
        vy: (_x, _y, _t, _p) => 0, 
        div: (_x, _y, _t, _p) => 0, 
        params: { A: { val: 2, min: 0, max: 5, step: 0.1 }, omega: { val: 2, min: 0.1, max: 10, step: 0.1, name: 'ω' } }, 
        equation: '\\vec{v} = (A \\sin(\\omega t), 0)', 
        divEquation: '\\nabla \\cdot \\vec{v} = 0' 
    },
};

const EulerLagrange = () => {
    // --- State ---
    const [flowType, setFlowType] = useState<FlowType>('Uniforme');
    const [params, setParams] = useState<any>({});
    const [isPlaying, setIsPlaying] = useState(false);
    const [time, setTime] = useState(0);
    const [metric, setMetric] = useState<'none' | 'density' | 'magnitude'>('none');
    const [showQuiver, setShowQuiver] = useState(true);
    const [showTracers, setShowTracers] = useState(true);
    const [particleDensity, setParticleDensity] = useState(200);
    const [followMode, setFollowMode] = useState<'none' | 'awaiting' | 'following'>('none');
    const [configOpen, setConfigOpen] = useState(false);
    const isPortrait = useIsPortrait();


    // --- Refs ---
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const followedParticleRef = useRef<Particle | null>(null);
    const paramsRef = useRef<any>({}); // Ref for loop access

    // DOM Refs for KaTeX
    const eqVxRef = useRef<HTMLParagraphElement>(null);
    const eqDivRef = useRef<HTMLParagraphElement>(null);

    // --- Helpers ---
    const mapToDomain = (px: number, py: number, width: number, height: number, domain: {x:number[], y:number[]}) => {
        const x = domain.x[0] + (px / width) * (domain.x[1] - domain.x[0]);
        const y = domain.y[1] - (py / height) * (domain.y[1] - domain.y[0]);
        return { x, y };
    };

    const mapToCanvas = (x: number, y: number, width: number, height: number, domain: {x:number[], y:number[]}) => {
        const px = ((x - domain.x[0]) / (domain.x[1] - domain.x[0])) * width;
        const py = ((domain.y[1] - y) / (domain.y[1] - domain.y[0])) * height;
        return { px, py };
    };

    const createParticle = (domain: {x:number[], y:number[]}): Particle => ({
        x: domain.x[0] + Math.random() * (domain.x[1] - domain.x[0]),
        y: domain.y[0] + Math.random() * (domain.y[1] - domain.y[0]),
        history: [],
        age: 0,
        lifetime: 5 + Math.random() * 5,
        alpha: 0,
        rho: 1.0
    });

    // --- Initialization & Updates ---
    useEffect(() => {
        // Init Params for Flow Type
        const defaultParams: any = {};
        Object.entries(FLOWS[flowType].params).forEach(([key, p]) => {
            defaultParams[key] = p.val;
        });
        setParams(defaultParams);
        paramsRef.current = defaultParams;
        
        // Reset Time & Particles
        setTime(0);
        particlesRef.current = [];
        followedParticleRef.current = null;
        setFollowMode('none');

        // Render Equations
        if (eqVxRef.current) katex.render(FLOWS[flowType].equation, eqVxRef.current, { throwOnError: false });
        if (eqDivRef.current) katex.render(FLOWS[flowType].divEquation, eqDivRef.current, { throwOnError: false });

    }, [flowType]);

    // --- Loop ---


    // --- Refactored Loop Logic ---
    const timeRef = useRef(0);
    
    const loop = useCallback(() => {
        const dt = 0.016; // Fixed timestep for physics consistency? Or delta?
        // Original used fixed 0.016
        
        if (isPlaying) {
             timeRef.current += dt;
             if (timeRef.current > 100) timeRef.current = 0;
             // Sync UI only every few frames to save React renders?
             // Or just setTime every frame (modern React handles it okay usually, but batched).
             setTime(timeRef.current);
        }

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) {
            requestRef.current = requestAnimationFrame(loop);
            return;
        }

        const width = canvas.width;
        const height = canvas.height;
        const aspect = width / height;
        const domain = { x: [-5 * aspect, 5 * aspect], y: [-5, 5] };
        
        // Clear
        const bg = ctx.createLinearGradient(0, 0, 0, height);
        bg.addColorStop(0, '#111827');
        bg.addColorStop(1, '#0c101a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        // Offset
        let offsetX = 0, offsetY = 0;
        if (followedParticleRef.current) {
             const cx = (domain.x[0] + domain.x[1]) / 2;
             const cy = (domain.y[0] + domain.y[1]) / 2;
             offsetX = followedParticleRef.current.x - cx;
             offsetY = followedParticleRef.current.y - cy;
        }

        // Flow & Params
        const flow = FLOWS[flowType];
        const p = paramsRef.current;
        const t = timeRef.current;

        // Metric Map (Heatmap)
        if (metric !== 'none') {
            const imageData = ctx.createImageData(width, height);
            const data = imageData.data;
            const step = 4; // optimization
            let minVal = Infinity, maxVal = -Infinity;
            
            // 1. Calc Range (Sampled)
            for (let py = 0; py < height; py += step) {
                for (let px = 0; px < width; px += step) {
                    const { x, y } = mapToDomain(px, py, width, height, domain);
                    const wx = x + offsetX; const wy = y + offsetY;
                    let val = 0;
                    if (metric === 'density') val = flow.div(wx, wy, t, p);
                    else { const vx = flow.vx(wx, wy, t, p); const vy = flow.vy(wx, wy, t, p); val = Math.sqrt(vx*vx+vy*vy); }
                    if (isFinite(val)) { minVal = Math.min(minVal, val); maxVal = Math.max(maxVal, val); }
                }
            }
            if (minVal >= maxVal) { minVal -= 1; maxVal += 1; }
            if (metric === 'density') { const abs = Math.max(Math.abs(minVal), Math.abs(maxVal)); minVal = -abs; maxVal = abs; }
            else minVal = 0;
            const range = maxVal - minVal || 1;

            // 2. Draw Pixel Data
            for (let py = 0; py < height; py++) {
                for (let px = 0; px < width; px++) {
                    const { x, y } = mapToDomain(px, py, width, height, domain);
                    const wx = x + offsetX; const wy = y + offsetY;
                    let val = 0;
                    if (metric === 'density') val = flow.div(wx, wy, t, p);
                    else { const vx = flow.vx(wx, wy, t, p); const vy = flow.vy(wx, wy, t, p); val = Math.sqrt(vx*vx+vy*vy); }
                    
                    const norm = (val - minVal) / range;
                    let r=0, g=0, b=0;
                    
                    if (metric === 'density') { // Divergence Color (Blue-White-Red)
                        const nt = Math.max(0, Math.min(1, norm));
                        if (nt < 0.5) { const f = nt*2; r=Math.round(f*255); g=Math.round(f*255); b=255; }
                        else { const f=(nt-0.5)*2; r=255; g=Math.round((1-f)*255); b=Math.round((1-f)*255); }
                    } else { // Magnitude (Heatmap)
                        // Simple Turbo-ish or similar
                        // Using logic from original
                        const nt = Math.max(0, Math.min(1, norm));
                        r = Math.round(255 * (0.277 + nt * (2.95 - 4.9*nt + 2.1*nt*nt)));
                        g = Math.round(255 * (0.005 + nt * (2.03 - 2.8*nt*nt)));
                        b = Math.round(255 * (0.369 - nt * (1.63 - 2.8*nt + 1.9*nt*nt)));
                    }
                    
                    const idx = (py * width + px) * 4;
                    data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 150; // alpha
                }
            }
            ctx.putImageData(imageData, 0, 0);
        }

        // Quiver
        if (showQuiver) {
            const gridSize = 30;
            ctx.lineWidth = 1.5;
            let maxMag = 0;
            const vects: {px:number, py:number, vx:number, vy:number, mag:number}[] = [];
            
            for(let px = gridSize/2; px < width; px+=gridSize) {
                for(let py = gridSize/2; py < height; py+=gridSize) {
                    const {x, y} = mapToDomain(px, py, width, height, domain);
                    const wx = x + offsetX; const wy = y + offsetY;
                    const vx = flow.vx(wx, wy, t, p);
                    const vy = flow.vy(wx, wy, t, p);
                    const mag = Math.sqrt(vx*vx + vy*vy);
                    maxMag = Math.max(maxMag, mag);
                    vects.push({px, py, vx, vy, mag});
                }
            }
            if (maxMag===0) maxMag=1;
            
            vects.forEach(v => {
                const scale = Math.min(1, v.mag / maxMag) * (gridSize * 0.8);
                if (scale < 2) return;
                const angle = Math.atan2(v.vy, v.vx);
                const hue = 200 - (v.mag/maxMag)*140; 
                ctx.strokeStyle = `hsla(${hue}, 90%, 65%, 0.6)`;
                
                ctx.save();
                ctx.translate(v.px, v.py);
                ctx.rotate(-angle);
                ctx.beginPath();
                ctx.moveTo(-scale/2, 0); ctx.lineTo(scale/2, 0);
                ctx.lineTo(scale/2 - 3, -3); ctx.moveTo(scale/2, 0); ctx.lineTo(scale/2 - 3, 3);
                ctx.stroke();
                ctx.restore();
            });
        }

        // Update Particles (Physics)
        const count = particlesRef.current.length;
        if (count < particleDensity) {
             for(let i=0; i<particleDensity-count; i++) particlesRef.current.push(createParticle(domain));
        } else if (count > particleDensity) {
             particlesRef.current.splice(particleDensity);
        }
        
        // Always include followed particle if valid
        if (followedParticleRef.current && !particlesRef.current.includes(followedParticleRef.current)) {
            particlesRef.current.push(followedParticleRef.current);
        }

        if (isPlaying) {
             particlesRef.current.forEach((pt, i) => {
                 // Update Density
                 const div = flow.div(pt.x, pt.y, t, p);
                 pt.rho -= pt.rho * div * dt;
                 pt.rho = Math.max(0.2, Math.min(pt.rho, 5.0));

                 // Update Pos (Midpoint)
                 const vx1 = flow.vx(pt.x, pt.y, t, p);
                 const vy1 = flow.vy(pt.x, pt.y, t, p);
                 const xm = pt.x + vx1 * dt * 0.5;
                 const ym = pt.y + vy1 * dt * 0.5;
                 const vx2 = flow.vx(xm, ym, t + dt*0.5, p);
                 const vy2 = flow.vy(xm, ym, t + dt*0.5, p);
                 pt.x += vx2 * dt;
                 pt.y += vy2 * dt;

                 // Age
                 if (!pt.isFollowed) {
                     pt.age += dt;
                     if (pt.age >= pt.lifetime) particlesRef.current[i] = createParticle(domain);
                     else {
                         // Alpha fade
                         if (pt.age < 1) pt.alpha = pt.age;
                         else if (pt.age > pt.lifetime - 1) pt.alpha = pt.lifetime - pt.age;
                         else pt.alpha = 1;
                     }
                 } else {
                     pt.alpha = 1;
                 }
                 
                 pt.history.push({x: pt.x, y: pt.y});
                 if (pt.history.length > 50) pt.history.shift();
             });
        }

        // Draw Tracers
        if (showTracers) {
             particlesRef.current.forEach(pt => {
                 if (pt.alpha <= 0) return;
                 const { px, py } = mapToCanvas(pt.x - offsetX, pt.y - offsetY, width, height, domain);
                 
                 // Trail
                 if (pt.history.length > 1) {
                     ctx.beginPath();
                     ctx.lineWidth = pt.isFollowed ? 2 : 1;
                     pt.history.forEach((h, i) => {
                         const hp = mapToCanvas(h.x - offsetX, h.y - offsetY, width, height, domain);
                         ctx.strokeStyle = `rgba(255,255,255, ${(i/pt.history.length) * 0.5 * pt.alpha})`;
                         if (i===0) ctx.moveTo(hp.px, hp.py);
                         else ctx.lineTo(hp.px, hp.py);
                     });
                     ctx.stroke();
                 }

                 // Head
                 const r = pt.isFollowed ? 6 : (1 + pt.rho);
                 ctx.beginPath();
                 ctx.arc(px, py, Math.max(1, r), 0, Math.PI*2);
                 ctx.fillStyle = pt.isFollowed 
                    ? `rgba(50, 255, 150, ${pt.alpha})` 
                    : `rgba(255, 100, 100, ${0.8 * pt.alpha})`;
                 ctx.fill();
             });
        }

        requestRef.current = requestAnimationFrame(loop);

    }, [flowType, isPlaying, metric, particleDensity, showQuiver, showTracers]);


    // Start/Stop Loop
    useEffect(() => {
        requestRef.current = requestAnimationFrame(loop);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [loop]);

    // Handle Resize
    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current && canvasRef.current.parentElement) {
                const w = canvasRef.current.parentElement.clientWidth;
                canvasRef.current.width = w;
                canvasRef.current.height = w * (9/16); // 16:9
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Interaction
    const handleCanvasClick = (e: React.MouseEvent) => {
        if (followMode !== 'awaiting' || !canvasRef.current) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        const width = canvasRef.current.width;
        const height = canvasRef.current.height;
        const aspect = width / height;
        const domain = { x: [-5 * aspect, 5 * aspect], y: [-5, 5] }; // Re-calc domain locally or store it?
        // Note: loop uses aspect from current canvas size. We must match.
        
        const { x, y } = mapToDomain(
            (e.clientX - rect.left) * (width / rect.width), 
            (e.clientY - rect.top) * (height / rect.height), 
            width, height, domain
        );

        const newP: Particle = {
            x, y, history: [], age: 0, lifetime: Infinity, alpha: 1, rho: 1, isFollowed: true
        };
        followedParticleRef.current = newP;
        setFollowMode('following');
    };

    return (
        <div className="w-full text-slate-200 font-sans relative">
            {/* Portrait: Floating config toggle */}
            {isPortrait && (
                <button
                    onClick={() => setConfigOpen(!configOpen)}
                    className="fixed bottom-4 right-4 z-50 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-blue-900/40 transition-all"
                >
                    {configOpen ? <X size={22} /> : <Settings size={22} />}
                </button>
            )}

            {/* Portrait backdrop */}
            {isPortrait && configOpen && (
                <div className="fixed inset-0 bg-black/50 z-30" onClick={() => setConfigOpen(false)} />
            )}

             <div className={`max-w-7xl mx-auto p-1 md:p-2 ${
                isPortrait
                    ? 'flex flex-col gap-3'
                    : 'grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3 h-full'
             }`}>
                
                {/* Main Area */}
                <div className="flex flex-col gap-2 min-h-0">
                    {/* Top Controls */}
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-wrap gap-3 items-center justify-between">
                         <div className="flex items-center gap-3">
                            <label className="font-bold text-slate-400 text-sm">Flujo:</label>
                            <select 
                                value={flowType} 
                                onChange={e => setFlowType(e.target.value as FlowType)}
                                className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:border-blue-500"
                            >
                                {Object.keys(FLOWS).map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                         </div>
                         
                         <div className="flex flex-wrap gap-4">
                            {Object.entries(FLOWS[flowType].params).map(([key, pDefinition]) => (
                                <div key={key} className="flex items-center gap-2">
                                    <label className="font-mono text-xs text-blue-400">{pDefinition.name || key}:</label>
                                    <input 
                                        type="range" 
                                        min={pDefinition.min} max={pDefinition.max} step={pDefinition.step}
                                        value={params[key] || pDefinition.val}
                                        onChange={e => {
                                            const v = parseFloat(e.target.value);
                                            setParams((prev:any) => {
                                                const next = {...prev, [key]: v};
                                                paramsRef.current = next;
                                                return next;
                                            });
                                        }}
                                        className="w-24 accent-blue-500 h-2 bg-slate-700 rounded-lg appearance-none"
                                    />
                                    <span className="font-mono text-xs w-8 text-right">{params[key]?.toFixed(1)}</span>
                                </div>
                            ))}
                         </div>
                    </div>

                    {/* Canvas */}
                    <div className="relative w-full aspect-video bg-black rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                        <canvas ref={canvasRef} 
                            onClick={handleCanvasClick}
                            className={`w-full h-full block ${followMode==='awaiting' ? 'cursor-crosshair' : 'cursor-default'}`} 
                        />
                        
                        {/* Legend Overlay if Metric active */}
                        {metric !== 'none' && (
                            <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur p-2 rounded border border-slate-700 text-xs flex flex-col items-center gap-1">
                                <span>{metric==='density' ? 'Baja' : 'Alta'}</span>
                                <div className="w-4 h-20 bg-gradient-to-t from-blue-600 via-white to-red-600 border border-slate-500" 
                                     style={{background: metric==='density' ? 'linear-gradient(to top, blue, #111827, red)' : 'linear-gradient(to top, #111827, blue, cyan, white)'}} // Approx
                                />
                                <span>{metric==='density' ? 'Alta' : 'Baja'}</span>
                            </div>
                        )}
                        
                        {/* Follow Mode Hint */}
                        {followMode === 'awaiting' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                                <div className="bg-blue-600 px-4 py-2 rounded-full text-white text-sm font-bold shadow-lg animate-pulse">
                                    Haz clic para soltar partícula
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Bottom Controls */}
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
                        <button onClick={() => setIsPlaying(!isPlaying)} className="p-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors">
                            {isPlaying ? <Pause size={20}/> : <Play size={20}/>}
                        </button>
                        
                        <div className="flex-1 flex items-center gap-3">
                            <span className="text-xs font-mono text-slate-500">t:</span>
                            <input 
                                type="range" min="0" max="100" step="0.1" 
                                value={time} 
                                onChange={e => {
                                    const t = parseFloat(e.target.value);
                                    setTime(t);
                                    timeRef.current = t;
                                }}
                                className="flex-1 accent-slate-500 h-2 bg-slate-800 rounded-lg appearance-none"
                            />
                            <span className="font-mono text-sm text-slate-300 w-12">{time.toFixed(1)}s</span>
                        </div>
                        
                        <button onClick={() => {
                            setTime(0); timeRef.current = 0;
                            particlesRef.current = [];
                            followedParticleRef.current = null;
                            setFollowMode('none');
                        }} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <RotateCcw size={20}/>
                        </button>
                    </div>
                </div>

                {/* Sidebar */}
                <div className={`flex flex-col gap-3 ${
                    isPortrait
                        ? `fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto transform transition-transform duration-300 ease-in-out ${configOpen ? 'translate-y-0' : 'translate-y-full'} bg-slate-950 p-4 rounded-t-2xl border-t border-slate-800`
                        : 'min-h-0'
                }`}>
                    
                    {/* Info */}
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                        <div className="border-b border-slate-800 pb-2 mb-2">
                            <h3 className="font-bold text-sm text-slate-200">Ecuaciones del Flujo</h3>
                        </div>
                        
                        <div>
                            <div className="text-xs text-slate-500 mb-1">Campo de Velocidad</div>
                            <p ref={eqVxRef} className="text-lg text-cyan-400 min-h-[2.5rem] flex items-center"></p>
                        </div>
                        
                        <div>
                            <div className="text-xs text-slate-500 mb-1">Divergencia (Compresibilidad)</div>
                            <p ref={eqDivRef} className="text-lg text-rose-400 min-h-[2.5rem] flex items-center"></p>
                        </div>
                        
                        <div className="bg-slate-800/50 p-3 rounded text-xs text-slate-400 leading-relaxed">
                            <span className="font-bold text-slate-300">Nota:</span> La divergencia indica si el fluido se expande o comprime. (div v = 0) significa flujo incompresible.
                        </div>
                    </div>

                    {/* Vis Settings */}
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                         <h3 className="font-bold text-sm text-slate-200 border-b border-slate-800 pb-2">Visualización</h3>
                         
                         {/* Follow Button */}
                         <button 
                            onClick={() => {
                                if (followMode === 'following') {
                                    setFollowMode('none');
                                    followedParticleRef.current = null;
                                } else if (followMode === 'none') {
                                    setFollowMode('awaiting');
                                } else {
                                    setFollowMode('none');
                                }
                            }}
                            className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                                followMode === 'following' ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20' :
                                followMode === 'awaiting' ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse' :
                                'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            }`}
                         >
                            {followMode === 'following' ? <><Activity size={18}/> Vista Global</> : 
                             followMode === 'awaiting' ? <><MousePointer2 size={18}/> Clic en Mapa...</> : 
                             <><MousePointer2 size={18}/> Seguir Partícula</>}
                         </button>
                         
                         <div className="space-y-3">
                             <label className="flex items-center justify-between cursor-pointer">
                                 <span className="text-sm text-slate-300">Vectores (Quiver)</span>
                                 <div className={`w-10 h-6 rounded-full p-1 transition-colors ${showQuiver ? 'bg-blue-600' : 'bg-slate-700'}`}
                                      onClick={() => setShowQuiver(!showQuiver)}>
                                     <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showQuiver ? 'translate-x-4' : ''}`}/>
                                 </div>
                             </label>
                             
                             <label className="flex items-center justify-between cursor-pointer">
                                 <span className="text-sm text-slate-300">Trayectorias</span>
                                 <div className={`w-10 h-6 rounded-full p-1 transition-colors ${showTracers ? 'bg-blue-600' : 'bg-slate-700'}`}
                                      onClick={() => setShowTracers(!showTracers)}>
                                     <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showTracers ? 'translate-x-4' : ''}`}/>
                                 </div>
                             </label>

                             <div>
                                 <div className="text-xs text-slate-500 mb-2">Métrica de Fondo</div>
                                 <div className="flex bg-slate-800 rounded-lg p-1">
                                     {['none', 'density', 'magnitude'].map(opt => (
                                         <button 
                                            key={opt}
                                            onClick={() => setMetric(opt as any)}
                                            className={`flex-1 py-1 text-xs rounded font-medium transition-colors ${metric === opt ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                         >
                                             {opt === 'none' ? 'Ninguna' : opt === 'density' ? 'Densidad' : 'Magnitud'}
                                         </button>
                                     ))}
                                 </div>
                             </div>

                             <div>
                                 <div className="flex justify-between text-xs text-slate-500 mb-1">
                                     <span>Partículas</span>
                                     <span>{particleDensity}</span>
                                 </div>
                                 <input 
                                    type="range" min="50" max="1000" step="50"
                                    value={particleDensity}
                                    onChange={e => setParticleDensity(parseInt(e.target.value))}
                                    className="w-full accent-slate-500 h-2 bg-slate-800 rounded-lg appearance-none"
                                 />
                             </div>
                         </div>
                    </div>

                </div>

             </div>
        </div>
    );
};

export default EulerLagrange;
