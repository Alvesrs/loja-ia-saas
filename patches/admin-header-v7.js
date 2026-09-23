const fs=require('node:fs');
const p='public/admin-mobile.html';
let h=fs.readFileSync(p,'utf8');

const headerRe=/<header class="saintsHeader">[\s\S]*?<\/header><div class="pageLead">[\s\S]*?<\/div>/;
const m=h.match(headerRe);
if(!m) throw new Error('Cabeçalho SaintsAI v6 não encontrado.');

const header=m[0];
h=h.replace(header,'');
h=h.replace('<main class="app">','<main class="app">'+header);

h=h.replace(
  '.saintsHeader{position:sticky;top:0;',
  '.saintsHeader{position:sticky;top:0;'
);

fs.writeFileSync(p,h);
console.log('Admin header v7 aplicado: cabeçalho reposicionado antes da Home.');
