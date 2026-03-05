const fs = require('fs');
const path = './src/apps/HydrostaticPressure/HydrostaticPressure.tsx';
let txt = fs.readFileSync(path, 'utf8');

txt = txt.replace(/const \[pivotConfig[\s\S]*?\}\);/, '');
txt = txt.replace(/const pivotRuntimeRef[\s\S]*?\}\);/, '');

txt = txt.replace(/const resetPivot = [\s\S]*?\}\n    \};\n/, '');

txt = txt.replace(/\s*pivotConfig: currentPivot,\n/, '\n');
txt = txt.replace(/\s*pivotConfig,\n/g, '\n');

txt = txt.replace(/if \(currentPivot\.enabled\) \{[\s\S]*?ctx\.lineWidth = 1\.7;\n\s*\}/, '');

txt = txt.replace(/<div className="space-y-2 rounded-lg border border-cyan-500\/20 bg-cyan-500\/5 p-3">[\s\S]*?Reiniciar rotacion\s*<\/button>\s*<\/div>/, '');

txt = txt.replace(/\{pivotConfig\.enabled && \([\s\S]*?\}\)/, '');

txt = txt.replace(/interface PivotConfig \{[\s\S]*?\}\n/g, '');
txt = txt.replace(/interface PivotRuntime \{[\s\S]*?\}\n/g, '');

txt = txt.replace(/const pivotRuntime = pivotRuntimeRef\.current;/, '');

fs.writeFileSync(path, txt);
