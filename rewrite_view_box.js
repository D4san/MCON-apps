const fs = require('fs');

let content = fs.readFileSync('src/apps/StressTensor/StressTensor.tsx', 'utf8');

// The replacement replaced buildminX with a literal  but without braces, we used replace(/\$\$/g, '$')!

content = content.replace(/viewBox=\{\$.*?\}/g, 'viewBox={$ build{minY} build{vBoxW} build{vBoxH}}');
content = content.replace(/strokeDasharray=\{\$.*?\}/g, 'strokeDasharray={$ build{vBoxW*0.02}}');

fs.writeFileSync('src/apps/StressTensor/StressTensor.tsx', content);
