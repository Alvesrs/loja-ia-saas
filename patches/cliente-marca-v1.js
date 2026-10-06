const fs=require('node:fs');
for(const [a,b] of [['clienteMarca.controller.js','src/controllers/clienteMarca.controller.js'],['cliente-marca.html','public/cliente-marca.html'],['cliente-marca.js','public/js/cliente-marca.js']])fs.copyFileSync('patches/assets/'+a,b);
let r=fs.readFileSync('src/routes/clienteHub.routes.js','utf8');if(!r.includes('clienteMarca.controller')){r=r.replace('module.exports=r;',`const marca=require('../controllers/clienteMarca.controller');
const {exigirDonoDaLoja}=require('../middleware/lojaOwnership');
r.get('/marca',exigirDonoDaLoja,marca.obter);
r.put('/marca',exigirDonoDaLoja,marca.salvar);
module.exports=r;`);fs.writeFileSync('src/routes/clienteHub.routes.js',r);}
for(const kind of ['cliente','admin']){const p='public/'+kind+'-versao.json';const v=JSON.parse(fs.readFileSync(p,'utf8'));v.versao='2026.10.06.3';v.novidades=['Nome e foto personalizados por empresa','Atualização no menu Mais'];fs.writeFileSync(p,JSON.stringify(v)+'\n');}
let html=fs.readFileSync('public/cliente-central.html','utf8').replace(/2026\.10\.06\.2/g,'2026.10.06.3');fs.writeFileSync('public/cliente-central.html',html);
console.log('[cliente-marca-v1] identidade por empresa e atualização no menu.');
