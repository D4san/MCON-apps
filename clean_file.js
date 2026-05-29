const fs = require('fs');
let content = fs.readFileSync('src/apps/StressTensor/StressTensor.tsx', 'utf8');

// Regex is acting weird, let's just do slice
const startStr = '<svg width="100%" height="100%" viewBox={';
const endStr = 'className="drop-shadow-lg">';

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
    const before = content.slice(0, startIdx + startStr.length - 1);
    const after = content.slice(endIdx);
    content = before + '\$ build{minY} build{vBoxW} build{vBoxH}\} ' + after;
}

// Now dasharray
content = content.replace(/strokeDasharray=\{.*?\}/g, 'strokeDasharray={$ build{vBoxW*0.02}}');

fs.writeFileSync('src/apps/StressTensor/StressTensor.tsx', content);
