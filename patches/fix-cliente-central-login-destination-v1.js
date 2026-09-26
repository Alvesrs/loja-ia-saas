const fs=require('node:fs');
const p='public/login.html';
let s=fs.readFileSync(p,'utf8');

const re=/const\s+destinoPermitido\s*=\s*\[[^\]]*\]\s*;/;
if(!re.test(s)) throw new Error('Lista destinoPermitido não encontrada em login.html');

s=s.replace(re,"const destinoPermitido = ['dashboard.html','whatsapp.html','admin.html','admin-mobile.html','cliente-estoque.html','cliente-central.html'];");

fs.writeFileSync(p,s);
console.log('Login corrigido: cliente-central.html permitido como destino.');
