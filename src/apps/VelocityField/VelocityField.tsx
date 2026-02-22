import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RefreshCw, HelpCircle, Layers, Settings, Activity, Gauge, ChevronDown, X } from 'lucide-react';
import { useIsPortrait } from '../../hooks/useIsPortrait';

// --- Math Parser Helper ---
const evaluateMath = (expression: string, x: number, y: number, t: number) => {
  try {
    const sin = Math.sin; const cos = Math.cos; const tan = Math.tan;
    const abs = Math.abs; const sqrt = Math.sqrt; const pow = Math.pow;
    const exp = Math.exp; const log = Math.log; const PI = Math.PI;
    const min = Math.min; const max = Math.max;
    
    // Safety clamp to prevent infinity/NaN from crashing canvas
    // eslint-disable-next-line no-new-func
    const func = new Function('x', 'y', 't', 'sin', 'cos', 'tan', 'abs', 'sqrt', 'pow', 'exp', 'log', 'PI', 'min', 'max', `return ${expression};`);
    const val = func(x, y, t, sin, cos, tan, abs, sqrt, pow, exp, log, PI, min, max);
    return isNaN(val) ? 0 : val;
  } catch (e) {
    return 0;
  }
};

// --- Preset Configurations ---
const PRESETS = [
  {
    id: "rotation",
    name: "Rotación Cuerpo Rígido",
    u: "-y",
    v: "x",
    desc: "Vorticidad constante. Todo gira junto."
  },
  {
    id: "vortex",
    name: "Vórtice Libre",
    u: "-y / (x*x + y*y + 0.1)",
    v: "x / (x*x + y*y + 0.1)",
    desc: "Velocidad aumenta al centro. Irrotacional excepto en (0,0)."
  },
  {
    id: "wave",
    name: "Onda Viajera (Oscilante)",
    u: "1",
    v: "cos(x - t*2)",
    desc: "Onda transversal. Diferencia clara entre Stream/Path/Streak."
  },
  {
    id: "stagnation",
    name: "Punto de Estancamiento",
    u: "x",
    v: "-y",
    desc: "Flujo impactando contra una pared horizontal."
  },
  {
    id: "shear",
    name: "Cizalladura (Shear)",
    u: "y",
    v: "0",
    desc: "Capas de fluido deslizándose."
  },
  {
    id: "pulsing",
    name: "Fuente Pulsante",
    u: "x * (0.5 + 0.5*sin(t*3))",
    v: "y * (0.5 + 0.5*sin(t*3))",
    desc: "Explosión cíclica desde el centro."
  },
  {
    id: "double_vortex",
    name: "Dipolo de Vórtices",
    u: "-y/((x-2)**2 + y**2 + 0.1) - y/((x+2)**2 + y**2 + 0.1)",
    v: "(x-2)/((x-2)**2 + y**2 + 0.1) + (x+2)/((x+2)**2 + y**2 + 0.1)",
    desc: "Dos vórtices interactuando."
  }
];

interface Particle {
  x: number;
  y: number;
  age: number;
  history: {x: number, y: number}[];
}

interface Injector {
  x: number;
  y: number;
  emitted: {x: number, y: number, life: number}[];
}

const VelocityField = () => {
  // --- State ---
  const [uEq, setUEq] = useState("-y"); 
  const [vEq, setVEq] = useState("x");
  const [t, setT] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [simSpeed, setSimSpeed] = useState(1.0); // Speed multiplier
  
  // Visualization Toggles
  const [showVectorField, setShowVectorField] = useState(true);
  const [showStreamlines, setShowStreamlines] = useState(false);
  const [showPathlines, setShowPathlines] = useState(true);
  const [showStreaklines, setShowStreaklines] = useState(false);
  
  // UI States
  const [showGuide, setShowGuide] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState("rotation");
  const [configOpen, setConfigOpen] = useState(false);
  const isPortrait = useIsPortrait();

  // Constants
  const BASE_DT = 0.015;
  
  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  
  // Simulation Data Refs
  const particlesRef = useRef<Particle[]>([]); 
  const streaksRef = useRef<Injector[]>([]);
  
  // Initialize Simulation
  useEffect(() => {
    // Pathlines Particles
    const initialParticles: Particle[] = [];
    for(let i=0; i<400; i++) { // Increased count
      initialParticles.push({
        x: (Math.random() - 0.5) * 10,
        y: (Math.random() - 0.5) * 10,
        age: Math.random() * 100,
        history: [] 
      });
    }
    particlesRef.current = initialParticles;

    // Streaklines Injectors (Denser grid)
    const injectors: Injector[] = [];
    for(let x = -4; x <= 4; x+=2) {
      for(let y = -4; y <= 4; y+=2) {
        injectors.push({
          x: x, 
          y: y, 
          emitted: [] // Array of {x, y, age}
        });
      }
    }
    streaksRef.current = injectors;
  }, []);

  // --- Main Animation Loop ---
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Canvas dimensions
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    
    // Coordinate Mapper: World (-5 to 5) -> Screen
    const scale = width / 10; 
    const toScreen = (x: number, y: number) => ({
      cx: (x + 5) * scale,
      cy: (5 - y) * scale 
    });

    // 0. Background Grid (Subtle)
    ctx.strokeStyle = '#1e293b'; // Very dark blue/slate
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Grid lines
    for(let i=-5; i<=5; i+=1) {
       const p1 = toScreen(i, -5); const p2 = toScreen(i, 5);
       ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy);
       const p3 = toScreen(-5, i); const p4 = toScreen(5, i);
       ctx.moveTo(p3.cx, p3.cy); ctx.lineTo(p4.cx, p4.cy);
    }
    ctx.stroke();

    // Axis
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const origin = toScreen(0,0);
    ctx.moveTo(0, origin.cy); ctx.lineTo(width, origin.cy);
    ctx.moveTo(origin.cx, 0); ctx.lineTo(origin.cx, height);
    ctx.stroke();

    // Time Update
    const effectiveDt = BASE_DT * simSpeed;
    let currentT = t;
    if (isPlaying) {
      currentT += effectiveDt;
      setT(prev => prev + effectiveDt);
    }

    // --- RENDER LAYERS ---

    // A. Vector Field
    if (showVectorField) {
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)'; // Slate 600, transparent
      ctx.fillStyle = 'rgba(71, 85, 105, 0.5)';
      const step = 0.5; 
      for (let x = -5; x <= 5; x += step) {
        for (let y = -5; y <= 5; y += step) {
          const u = evaluateMath(uEq, x, y, currentT);
          const v = evaluateMath(vEq, x, y, currentT);
          const mag = Math.sqrt(u*u + v*v);
          
          if (mag > 0.01) {
            const start = toScreen(x, y);
            const drawLen = Math.min(0.35, mag * 0.15); // Clamped length
            const endX = x + (u/mag) * drawLen;
            const endY = y + (v/mag) * drawLen;
            const end = toScreen(endX, endY);
            
            ctx.beginPath();
            ctx.moveTo(start.cx, start.cy);
            ctx.lineTo(end.cx, end.cy);
            ctx.stroke();
            
            // Arrowhead
            const angle = Math.atan2(end.cy - start.cy, end.cx - start.cx);
            ctx.beginPath();
            ctx.moveTo(end.cx, end.cy);
            ctx.lineTo(end.cx - 3 * Math.cos(angle - Math.PI/6), end.cy - 3 * Math.sin(angle - Math.PI/6));
            ctx.lineTo(end.cx - 3 * Math.cos(angle + Math.PI/6), end.cy - 3 * Math.sin(angle + Math.PI/6));
            ctx.fill();
          }
        }
      }
    }

    // B. Streamlines (Yellow)
    if (showStreamlines) {
      ctx.strokeStyle = '#fbbf24'; // Amber 400
      ctx.lineWidth = 1.5;
      
      const seeds = [];
      for(let x=-4; x<=4; x+=1.2) {
        for(let y=-4; y<=4; y+=1.2) seeds.push({x, y});
      }

      seeds.forEach(seed => {
        let currX = seed.x;
        let currY = seed.y;
        
        ctx.beginPath();
        const startPos = toScreen(currX, currY);
        ctx.moveTo(startPos.cx, startPos.cy);

        for(let i=0; i<40; i++) {
          const u = evaluateMath(uEq, currX, currY, currentT);
          const v = evaluateMath(vEq, currX, currY, currentT);
          const mag = Math.sqrt(u*u + v*v);
          
          if (mag < 0.01 || Math.abs(currX) > 6 || Math.abs(currY) > 6) break;

          const ds = 0.1; 
          currX += (u/mag) * ds;
          currY += (v/mag) * ds;
          
          const p = toScreen(currX, currY);
          ctx.lineTo(p.cx, p.cy);
        }
        ctx.stroke();
      });
    }

    // C. Pathlines (Cyan Particles)
    if (showPathlines) {
      ctx.fillStyle = '#22d3ee'; // Cyan 400
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
      ctx.lineWidth = 1;

      particlesRef.current.forEach(p => {
        if (isPlaying) {
          const u = evaluateMath(uEq, p.x, p.y, currentT);
          const v = evaluateMath(vEq, p.x, p.y, currentT);
          
          p.x += u * effectiveDt;
          p.y += v * effectiveDt;
          
          p.history.push({x: p.x, y: p.y});
          if(p.history.length > 25) p.history.shift();

          // Reset logic
          if (Math.abs(p.x) > 6 || Math.abs(p.y) > 6) {
            p.x = (Math.random() - 0.5) * 10;
            p.y = (Math.random() - 0.5) * 10;
            p.history = [];
          }
        }

        // Tail
        if (p.history.length > 1) {
          ctx.beginPath();
          const start = toScreen(p.history[0].x, p.history[0].y);
          ctx.moveTo(start.cx, start.cy);
          for(let i=1; i<p.history.length; i++) {
            const pt = toScreen(p.history[i].x, p.history[i].y);
            ctx.lineTo(pt.cx, pt.cy);
          }
          ctx.stroke();
        }
        // Head
        const scr = toScreen(p.x, p.y);
        ctx.beginPath();
        ctx.arc(scr.cx, scr.cy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // D. Streaklines (Red/Pink Smoke)
    if (showStreaklines) {
      ctx.lineWidth = 2;
      
      streaksRef.current.forEach(injector => {
        // 1. Emit
        // Using a fractional counter or just checking time isn't smooth. 
        // We emit every few frames.
        if (isPlaying && Math.random() < 0.4 * simSpeed) { // Adjust emission rate by speed
           // Higher 'life' for longer trails (Modified to 800 for longer tails)
           injector.emitted.push({x: injector.x, y: injector.y, life: 800}); 
        }

        // 2. Update Physics
        if (isPlaying) {
          for(let i = injector.emitted.length - 1; i >= 0; i--) {
            const p = injector.emitted[i];
            const u = evaluateMath(uEq, p.x, p.y, currentT);
            const v = evaluateMath(vEq, p.x, p.y, currentT);
            
            p.x += u * effectiveDt;
            p.y += v * effectiveDt;
            p.life -= 1 * simSpeed; // Decay faster if speed is high

            if (p.life <= 0 || Math.abs(p.x) > 7 || Math.abs(p.y) > 7) {
               injector.emitted.splice(i, 1);
            }
          }
        }

        // 3. Draw with Fading Tail
        // We draw segments so we can control opacity along the line
        if (injector.emitted.length > 1) {
           const points = injector.emitted;
           
           for(let i = 0; i < points.length - 1; i++) {
             const p1 = points[i];
             const p2 = points[i+1];
             const scr1 = toScreen(p1.x, p1.y);
             const scr2 = toScreen(p2.x, p2.y);

             // Calculate opacity based on index (index 0 is oldest/tail)
             // Using a non-linear fade for better aesthetics
             const alpha = Math.min(1, (i / points.length)); 
             
             ctx.beginPath();
             ctx.moveTo(scr1.cx, scr1.cy);
             ctx.lineTo(scr2.cx, scr2.cy);
             ctx.strokeStyle = `rgba(244, 63, 94, ${alpha * 0.8})`; // Rose-500 with variable alpha
             ctx.stroke();
           }
        }
        
        // Injector dot
        const injPos = toScreen(injector.x, injector.y);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(injPos.cx, injPos.cy, 2, 0, Math.PI*2);
        ctx.fill();
      });
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [t, isPlaying, uEq, vEq, showVectorField, showStreamlines, showPathlines, showStreaklines, simSpeed]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // --- Handlers ---
  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pid = e.target.value;
    setSelectedPresetId(pid);
    const preset = PRESETS.find(p => p.id === pid);
    if(preset) {
      setUEq(preset.u);
      setVEq(preset.v);
      setT(0);
      particlesRef.current.forEach(p => { p.history = []; });
      streaksRef.current.forEach(s => s.emitted = []);
    }
  };

  return (
    <div className={`flex bg-slate-950 text-slate-200 font-sans overflow-hidden rounded-xl border border-slate-800 shadow-2xl h-full ${isPortrait ? 'flex-col' : 'flex-row'}`}>
      
      {/* Portrait: Floating config toggle */}
      {isPortrait && (
        <button
          onClick={() => setConfigOpen(!configOpen)}
          className="fixed bottom-4 right-4 z-50 p-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full shadow-lg shadow-cyan-900/40 transition-all"
        >
          {configOpen ? <X size={22} /> : <Settings size={22} />}
        </button>
      )}

      {/* Sidebar */}
      <div className={`${isPortrait 
        ? `fixed inset-x-0 bottom-0 z-40 max-h-[75vh] transform transition-transform duration-300 ease-in-out ${configOpen ? 'translate-y-0' : 'translate-y-full'}` 
        : 'w-80 flex-shrink-0'} bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl`}>
        
        {/* Header */}
        <div className="p-3 border-b border-slate-800 bg-slate-900">
          <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent flex items-center gap-2">
            <Activity size={20} className="text-cyan-400" />
            Continuum Lab
          </h1>
          <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider font-semibold">Visualizador de Fluidos 2D</p>
        </div>

        <div className="flex-1 p-3 space-y-3 custom-scrollbar">
          
          {/* Controls: Play & Speed */}
          <div className="space-y-2">
             <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`flex-1 py-2 px-4 rounded-md font-semibold transition-all flex items-center justify-center gap-2 ${isPlaying ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}
                >
                  {isPlaying ? <><Pause size={18}/> Pausar</> : <><Play size={18}/> Simular</>}
                </button>
                <button 
                  onClick={() => { setT(0); streaksRef.current.forEach(s => s.emitted = []); }}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-md transition-colors"
                  title="Reiniciar t=0"
                >
                  <RefreshCw size={18} />
                </button>
             </div>
             
             {/* Speed Slider */}
             <div className="bg-slate-800/50 p-2 rounded-md border border-slate-700/50">
               <div className="flex justify-between text-xs text-slate-400 mb-1">
                 <span className="flex items-center gap-1"><Gauge size={12}/> Velocidad</span>
                 <span className="font-mono text-cyan-400">{simSpeed.toFixed(1)}x</span>
               </div>
               <input 
                 type="range" 
                 min="0.1" max="2.0" step="0.1"
                 value={simSpeed}
                 onChange={(e) => setSimSpeed(parseFloat(e.target.value))}
                 className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
               />
               <div className="mt-1 text-right font-mono text-xs text-slate-500">
                 t = {t.toFixed(2)}s
               </div>
             </div>
          </div>

          {/* Preset Dropdown */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
              <Settings size={14} /> Presets de Flujo
            </label>
            <div className="relative">
              <select 
                value={selectedPresetId}
                onChange={handlePresetChange}
                className="w-full bg-slate-800 text-slate-200 text-sm border border-slate-700 rounded-md p-2.5 appearance-none focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
              >
                {PRESETS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-3 text-slate-500 pointer-events-none"/>
            </div>
            <p className="text-[11px] text-slate-500 italic px-1 leading-tight">
              {PRESETS.find(p => p.id === selectedPresetId)?.desc}
            </p>
          </div>

          {/* Equation Input */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
               <label className="text-xs font-bold text-slate-500 uppercase">Definición Matemática</label>
            </div>
            
            <div className="space-y-2 font-mono text-sm">
              <div className="group relative">
                <div className="absolute left-3 top-2.5 text-rose-400 font-bold">u =</div>
                <input 
                  value={uEq}
                  onChange={(e) => setUEq(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md py-2 pl-10 pr-3 text-yellow-400 focus:border-rose-500 focus:outline-none transition-colors"
                />
              </div>
              <div className="group relative">
                <div className="absolute left-3 top-2.5 text-cyan-400 font-bold">v =</div>
                <input 
                  value={vEq}
                  onChange={(e) => setVEq(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md py-2 pl-10 pr-3 text-yellow-400 focus:border-cyan-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Visualization Modes */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
             <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <Layers size={14} /> Visualización
                </label>
                
                {/* Guide Button with Popover Logic */}
                <div className="relative">
                  <button 
                    onClick={() => setShowGuide(!showGuide)}
                    className={`p-1 rounded-full transition-colors ${showGuide ? 'bg-cyan-500 text-white' : 'text-slate-500 hover:text-cyan-400'}`}
                  >
                    <HelpCircle size={16} />
                  </button>
                  
                  {/* Guide Popover */}
                  {showGuide && (
                    <div className="absolute bottom-8 right-0 w-64 bg-slate-800 border border-slate-700 p-4 rounded-lg shadow-2xl z-50 text-xs">
                      <h4 className="font-bold text-white mb-2">Guía de Capas</h4>
                      <ul className="space-y-2">
                         <li className="flex gap-2">
                           <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0 mt-0.5"></span>
                           <div>
                             <strong className="text-amber-400 block">Líneas de Corriente</strong>
                             <span className="text-slate-400">Integral instantánea. Muestra la dirección del flujo AHORA.</span>
                           </div>
                         </li>
                         <li className="flex gap-2">
                           <span className="w-3 h-3 rounded-full bg-cyan-400 shrink-0 mt-0.5"></span>
                           <div>
                             <strong className="text-cyan-400 block">Trayectorias</strong>
                             <span className="text-slate-400">Historia real de partículas moviéndose. Lagrangiano.</span>
                           </div>
                         </li>
                         <li className="flex gap-2">
                           <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0 mt-0.5"></span>
                           <div>
                             <strong className="text-rose-400 block">Líneas de Traza</strong>
                             <span className="text-slate-400">Humo/Tinta inyectada continuamente desde puntos fijos.</span>
                           </div>
                         </li>
                      </ul>
                    </div>
                  )}
                </div>
             </div>

             <div className="space-y-1 bg-slate-950/50 p-1 rounded-lg">
                {[
                  { label: "Campo Vectorial", state: showVectorField, set: setShowVectorField, color: "text-slate-400" },
                  { label: "Líneas de Corriente", state: showStreamlines, set: setShowStreamlines, color: "text-amber-400" },
                  { label: "Trayectorias (Partículas)", state: showPathlines, set: setShowPathlines, color: "text-cyan-400" },
                  { label: "Líneas de Traza (Humo)", state: showStreaklines, set: setShowStreaklines, color: "text-rose-400" },
                ].map((opt, idx) => (
                  <label key={idx} className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${opt.state ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}>
                    <span className={`text-sm font-medium ${opt.state ? opt.color : 'text-slate-500'}`}>{opt.label}</span>
                    <input type="checkbox" checked={opt.state} onChange={(e) => opt.set(e.target.checked)} className="accent-cyan-500 w-4 h-4 rounded" />
                  </label>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* Portrait backdrop */}
      {isPortrait && configOpen && (
        <div className="fixed inset-0 bg-black/50 z-30" onClick={() => setConfigOpen(false)} />
      )}

      {/* Main Canvas Area */}
      <div className="flex-1 relative flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black min-h-0">
        <canvas 
          ref={canvasRef}
          width={900}
          height={900}
          className="max-w-[95%] max-h-[95%] object-contain rounded shadow-2xl border border-slate-800"
        />
        
        {/* Simple floating label for context */}
        <div className="absolute bottom-6 left-6 text-slate-600 text-xs font-mono pointer-events-none">
           Escala: 10x10 Unidades • Render: HTML5 Canvas 2D
        </div>
      </div>
    </div>
  );
};

export default VelocityField;
