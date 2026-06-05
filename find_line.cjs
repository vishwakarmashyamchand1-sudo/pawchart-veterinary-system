const fs = require('fs');
const lines = fs.readFileSync('client/src/main.jsx', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('title="Clients & Pets"'));
console.log(idx + 1);
console.log(lines[idx]);
console.log(lines[idx+1]);
console.log(lines[idx+2]);
