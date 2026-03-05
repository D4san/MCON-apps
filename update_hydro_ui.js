const fs = require('fs');
const path = './src/apps/HydrostaticPressure/HydrostaticPressure.tsx';
let txt = fs.readFileSync(path, 'utf8');

if (!txt.includes('Droplets')) {
    txt = txt.replace(/import \{ MousePointer2, Eraser, PenTool, Layers, Settings, X, ChevronDown, ChevronUp \} from 'lucide-react';/,
        "import { MousePointer2, Eraser, PenTool, Layers, Settings, X, ChevronDown, ChevronUp, Droplets } from 'lucide-react';");
}

const addWaterToolRegex = /<button\s+onClick=\{\(\) => setToolMode\('draw'\)\}[\s\S]*?<PenTool className="w-5 h-5" \/>\s+<\/button>/;
const waterToolStr = \<button
                    onClick={() => setToolMode('draw')}
                    aria-label="Dibujar paredes"
                    className={cn(
                        'p-3 rounded-lg transition-colors flex-1 flex justify-center',
                        toolMode === 'draw' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white'
                    )}
                >
                    <PenTool className="w-5 h-5" />
                </button>
                <button
                    onClick={() => setToolMode('water')}
                    aria-label="Añadir agua"
                    className={cn(
                        'p-3 rounded-lg transition-colors flex-1 flex justify-center',
                        toolMode === 'water' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
                    )}
                >
                    <Droplets className="w-5 h-5" />
                </button>\;
txt = txt.replace(addWaterToolRegex, waterToolStr);

const oldSelectorsBlock = /<div className="grid grid-cols-2 gap-3">[\s\S]*?<\/div>\\s*<\/div>/;

const newSelectorsBlock = \<div className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            <span>Gravedad</span>
                            <span className="text-cyan-400 font-mono">{gravityValue.toFixed(2)} m/s²</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={30}
                            step={0.1}
                            value={gravityValue}
                            onChange={(e) => setGravityValue(Number(e.target.value))}
                            className="w-full accent-cyan-400"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 font-medium px-1">
                            <button onClick={() => setGravityValue(1.62)} className="hover:text-white transition-colors">Luna</button>
                            <button onClick={() => setGravityValue(3.72)} className="hover:text-white transition-colors">Marte</button>
                            <button onClick={() => setGravityValue(9.81)} className="hover:text-white transition-colors border-b border-cyan-500 pb-0.5">Tierra</button>
                            <button onClick={() => setGravityValue(24.79)} className="hover:text-white transition-colors">Jupiter</button>
                        </div>
                    </div>
                </div>\;
txt = txt.replace(oldSelectorsBlock, newSelectorsBlock);

const removeNivelDeAguaRegex = /<div className="space-y-2 rounded-lg border border-white\\/10 bg-slate-950\\/40 p-3">[\\s\\S]*?<span>Nivel de agua<\\/span>[\\s\\S]*?<\\/div>\\s*<\\/div>\\s*<\\/div>/;
txt = txt.replace(removeNivelDeAguaRegex, "");

const removePivotUIRegex = /<div className="space-y-2 rounded-lg border border-cyan-500\\/20 bg-cyan-500\\/5 p-3">[\\s\\S]*?Reiniciar rotacion\\s*<\\/button>\\s*<\\/div>/;
txt = txt.replace(removePivotUIRegex, "");

const removePivotInfoRegex = /\\{pivotConfig\\.enabled && \\([\\s\\S]*?Torque[\\s\\S]*?<\\/div>\\s*\\)\\}/;
txt = txt.replace(removePivotInfoRegex, "");

fs.writeFileSync(path, txt);
