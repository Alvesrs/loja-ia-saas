const fs=require('node:fs');
fs.copyFileSync('patches/assets/cliente-dashboard-v2.js','public/js/cliente-dashboard-v2.js');
fs.copyFileSync('patches/assets/saintsai-polish-v4.css','public/css/saintsai-polish-v4.css');
for(const name of ['cliente-central.html','cliente-configuracao.html','cliente-produtos.html','cliente-estoque.html','cliente-agenda.html','cliente-whatsapp.html','cliente-plano.html','admin-mobile.html']){
 const p='public/'+name;let h=fs.readFileSync(p,'utf8');
 if(!h.includes('saintsai-polish-v4.css'))h=h.replace('</head>','<link rel="stylesheet" href="css/saintsai-polish-v4.css?v=2026.10.06.1"></head>');
 if(name==='cliente-central.html')h=h.replace(/js\/cliente-dashboard-v2.js\?v=[^"]+/g,'js/cliente-dashboard-v2.js?v=2026.10.06.1');
 if(name==='cliente-central.html')h=h.replace(/<div class="brand">SaintsAI (Dashboard|Cliente)<\/div>/g,'<div class="brand">SaintsAI</div>');
 fs.writeFileSync(p,h);
}
for(const kind of ['cliente','admin']){
 const p='public/'+kind+'-versao.json',v=JSON.parse(fs.readFileSync(p,'utf8'));
 v.versao='2026.10.06.1';v.publicado_em='2026-10-06';v.novidades=['Interface mais compacta no celular','Navegação e ações mais acessíveis','Painel de clientes com melhor leitura'];fs.writeFileSync(p,JSON.stringify(v)+'\n');
}
console.log('[saintsai-polish-v4] acabamento do cliente e painel proprietário aplicado.');

const updater='public/js/admin-atualizacao.js';fs.writeFileSync(updater,fs.readFileSync(updater,'utf8').replace(/Versão \d{4}\.\d{2}\.\d{2}\.\d+/g,'Versão 2026.10.06.1'));
