const fs=require('node:fs');
const p='public/login.html';
let s=fs.readFileSync(p,'utf8');
s=s.replace(/(['"]cliente-central\.html['"]\s*,?\s*)/g,'');
fs.writeFileSync(p,s);
console.log('Painel antigo restaurado: cliente-central removido do login administrativo.');
