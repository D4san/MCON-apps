const fs = require('fs');
const path = './src/apps/HydrostaticPressure/HydrostaticPressure.tsx';
let txt = fs.readFileSync(path, 'utf8');

// remove pivotRuntimeRef.current
txt = txt.replace(/const pivotRuntime = pivotRuntimeRef\.current;/, '');
txt = txt.replace(/\{pivotConfig\.enabled && \([\s\S]*?\}\)/, '');

fs.writeFileSync(path, txt);
