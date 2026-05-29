const fs = require('fs');
let c = fs.readFileSync('src/apps/StressTensor/StressTensor.tsx', 'utf8');

c = c.replace(/<X className=\"w-5 h-5\" \/>\s*\n\s*\n/gi, '<X className=\"w-5 h-5\" /></button>\n');

c = c.replace(/<Activity className=\"w-4 h-4 text-rose-400\" \/> Tracción Eje\s*\n/gi, '<Activity className=\"w-4 h-4 text-rose-400\" /> Tracción Eje</button>\n');
c = c.replace(/<Mountain className=\"w-4 h-4 text-emerald-400\" \/> Compresión\s*\n/gi, '<Mountain className=\"w-4 h-4 text-emerald-400\" /> Compresión</button>\n');
c = c.replace(/<ArrowDown className=\"w-4 h-4 text-cyan-400\" \/> Fluidostática\s*\n/gi, '<ArrowDown className=\"w-4 h-4 text-cyan-400\" /> Fluidostática</button>\n');
c = c.replace(/<Plane className=\"w-4 h-4 text-amber-400\" \/> Corte Puro\s*\n/gi, '<Plane className=\"w-4 h-4 text-amber-400\" /> Corte Puro</button>\n');

c = c.replace(/<RotateCcw className=\"w-4 h-4\" \/>\s*\n/gi, '<RotateCcw className=\"w-4 h-4\" /></button>\n');

c = c.replace(/<LocateFixed className=\"w-3 h-3\" \/> Ejes Principales\s*\n/gi, '<button onClick={alignToPrincipal} className=\"text-[10px] bg-amber-500/20 text-amber-300 px-2 py-1 rounded border border-amber-500/30 flex items-center gap-1 hover:bg-amber-500/30 transition\"><LocateFixed className=\"w-3 h-3\" /> Ejes Principales</button>\n');

fs.writeFileSync('src/apps/StressTensor/StressTensor.tsx', c);
