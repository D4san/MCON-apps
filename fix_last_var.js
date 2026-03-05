const fs = require('fs');
const path = './src/apps/HydrostaticPressure/HydrostaticPressure.tsx';
let txt = fs.readFileSync(path, 'utf8');

txt = txt.replace(/const pivotRuntime = pivotRuntimeRef\.current;/, '');

fs.writeFileSync(path, txt);
