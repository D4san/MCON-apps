const fs = require('fs');
let code = fs.readFileSync('src/apps/StressTensor/StressTensor.tsx', 'utf8');
const returnIndex = code.indexOf('return (');
if (returnIndex !== -1) {
  const beforeReturn = code.substring(0, returnIndex);
  const cleanJSX = `return (
    <div className="flex flex-col md:flex-row w-full h-[calc(100vh-64px)] bg-slate-900 text-slate-200 overflow-hidden font-sans relative">
      {/* SIDEBAR FOR CONTROLS */}
      <div className={\`flex flex-col w-full md:w-80 bg-slate-900 border-r border-slate-800 shadow-xl z-20 flex-shrink-0 transition-transform duration-300 \${isPortrait ? (isMobileMenuOpen ? 'absolute inset-0' : 'absolute -translate-x-full') : 'relative'}\`}>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-5">
          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                <Box className="w-5 h-5" />
              </div>
              <h2 className="font-semibold text-white truncate flex items-center gap-2">
                Tensor de Esfuerzos
              </h2>
            </div>
            {isPortrait && (
              <button 
                onClick={() => setIsMobileMenuOpen(false)} 
                className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* PRESETS */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-1">Casos Físicos</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => applyPreset({ xx: 100 })} className="p-2 text-xs bg-slate-800/80 hover:bg-slate-700 rounded border border-slate-700/50 flex flex-col items-center gap-1">
                <Activity className="w-4 h-4 text-rose-400" /> Tracción Eje
              </button>
              <button onClick={() => applyPreset({ yy: -120 })} className="p-2 text-xs bg-slate-800/80 hover:bg-slate-700 rounded border border-slate-700/50 flex flex-col items-center gap-1">
                <Mountain className="w-4 h-4 text-emerald-400" /> Compresión
              </button>
              <button onClick={() => applyPreset({ xx: -80, yy: -80, zz: -80 })} className="p-2 text-xs bg-slate-800/80 hover:bg-slate-700 rounded border border-slate-700/50 flex flex-col items-center gap-1">
                <ArrowDown className="w-4 h-4 text-cyan-400" /> Fluidostática
              </button>
              <button onClick={() => applyPreset({ xy: 60, yx: 60 })} className="p-2 text-xs bg-slate-800/80 hover:bg-slate-700 rounded border border-slate-700/50 flex flex-col items-center gap-1">
                <Plane className="w-4 h-4 text-amber-400" /> Corte Puro
              </button>
            </div>
          </div>

          <div className="h-px bg-slate-800 w-full" />

          {/* MATRIX INPUT */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-1 flex justify-between items-center">
              <span>Matriz Base (θ = 0°)</span>
              <button onClick={() => applyPreset(DEFAULT_STRESS)} className="text-slate-400 hover:text-slate-200">
                <RotateCcw className="w-4 h-4" />
              </button>
            </h3>
            
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-2 rounded border border-slate-800">
              {['xx', 'xy', 'xz', 'yx', 'yy', 'yz', 'zx', 'zy', 'zz'].map((key) => {
                const isDiag = key[0] === key[1];
                return (
                  <div key={key} className="flex flex-col gap-1 items-center">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {isDiag ? \`σ_\${key}\` : \`τ_\${key}\`}
                    </span>
                    <input
                      type="number"
                      value={stress[key as keyof StressState]}
                      onChange={(e) => handleMatrixChange(key as keyof StressState, e.target.value)}
                      className={\`w-full bg-slate-800 border \${isDiag ? 'border-indigo-500/50' : 'border-amber-500/30'} rounded px-1 py-1 text-center text-sm font-mono focus:outline-none focus:border-cyan-400\`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* TRANSFORMACION / ROTACION */}
          <div className="flex flex-col gap-3 p-3 bg-slate-800/30 border border-slate-700 rounded-lg">
             <h3 className="text-sm font-semibold text-amber-400 flex items-center justify-between">
               <span>Rotar Ejes (Plano XY)</span>
               <button onClick={alignToPrincipal} className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-1 rounded border border-amber-500/30 flex items-center gap-1 hover:bg-amber-500/30 transition">
                  <LocateFixed className="w-3 h-3" /> Ejes Principales
               </button>
             </h3>
             <div className="flex items-center gap-3">
               <span className="text-xs font-mono w-10">{theta.toFixed(0)}°</span>
               <input 
                 type="range" 
                 min="-90" 
                 max="90" 
                 step="1"
                 value={theta} 
                 onChange={(e) => setTheta(parseFloat(e.target.value))}
                 className="flex-1 accent-amber-500"
               />
             </div>

             {/* MATRIZ ROTADA (NUEVOS EJES) */}
             <div className="mt-3 p-3 bg-amber-950/20 rounded border border-amber-900/30">
               <div className="text-xs text-amber-200/80 mb-2 flex justify-between items-center font-medium">
                 <span>Matriz en nuevos ejes</span>
                 {Math.abs(prime.xy) < 0.1 && theta !== 0 && (
                   <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">¡Autovalores!</span>
                 )}
               </div>
               <div className="grid grid-cols-3 gap-1">
                 {['xx', 'xy', 'xz', 'yx', 'yy', 'yz', 'zx', 'zy', 'zz'].map((key) => {
                   const val = prime[key as keyof StressState];
                   const isDiag = key[0] === key[1];
                   const isZero = Math.abs(val) < 0.1;
                   return (
                     <div key={\`prime-\${key}\`} className={\`px-1 py-1 text-center text-xs font-mono rounded \${isDiag ? 'text-indigo-300' : 'text-amber-300'} \${isZero ? 'opacity-30' : ''} bg-slate-900/80 border border-slate-800/80\`}>
                       {isZero ? '0' : val.toFixed(1)}
                     </div>
                   );
                 })}
               </div>
               <p className="text-[10px] text-slate-500 mt-2 leading-tight">
                 Con <InlineMath tex="\\\\tau'_{xy} = 0" />, la diagonal son los <strong>Autovalores</strong>, y el ángulo marca el Autovector.
               </p>
             </div>
          </div>

          {/* CIRCULO DE MOHR */}
          <MohrCircle prime={prime} cx={cx} R={R} minX={minX} maxX={maxX} minY={minY} maxY={maxY} vBoxW={maxX - minX} vBoxH={maxY - minY} />

          {/* DEFORMATION TOGGLE */}
          <div className="flex flex-col gap-2 mt-2">
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-indigo-900/20 border border-indigo-500/30 rounded-lg hover:bg-indigo-900/40 transition">
              <input type="checkbox" className="hidden" checked={showDeformation} onChange={(e) => setShowDeformation(e.target.checked)} />
              <div className={\`relative w-10 h-6 transition-colors rounded-full \${showDeformation ? 'bg-indigo-500' : 'bg-slate-700'}\`}>
                <div className={\`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform \${showDeformation ? 'translate-x-4' : ''}\`} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-indigo-100">Ver Deformación</span>
                <span className="text-[10px] text-indigo-300/70">Ilustrativo en sistema local</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* 3D CANVAS */}
      <div className="flex-1 relative bg-[#0a0f1c] flex flex-col" ref={containerRef}>
        <canvas ref={canvasRef} className="w-full h-full block touch-none" />
        
        <div className="absolute top-4 left-4 pointer-events-none select-none">
          <div className="bg-slate-900/60 backdrop-blur rounded p-2 text-xs font-mono text-slate-300 border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-rose-500 inline-block"/> Tracción (+)</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-sky-500 inline-block"/> Compresión (-)</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block"/> Corte (τ)</div>
          </div>
        </div>

        {isPortrait && !isMobileMenuOpen && (
          <button 
             onClick={() => setIsMobileMenuOpen(true)}
             className="absolute bottom-4 right-4 z-10 bg-indigo-600 text-white p-3 rounded-full shadow-lg border border-indigo-400"
          >
             <Settings className="w-6 h-6" />
          </button>
        )}
      </div>
    </div>
  );
};
export default StressTensor;
`;
  fs.writeFileSync('src/apps/StressTensor/StressTensor.tsx', beforeReturn + cleanJSX);
}
