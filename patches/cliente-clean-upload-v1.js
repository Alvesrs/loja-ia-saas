const fs=require('node:fs');
fs.copyFileSync('patches/assets/imageUploadParsers.js','src/middleware/imageUploadParsers.js');
let app=fs.readFileSync('src/app.js','utf8');
const marker="require('./middleware/imageUploadParsers')(app);";
if(!app.includes(marker)){const anchor="app.use(express.json({ limit: '100kb' }));";if(!app.includes(anchor))throw Error('Parser geral não encontrado');app=app.replace(anchor,marker+'\n'+anchor);fs.writeFileSync('src/app.js',app);}
for(const kind of ['cliente','admin']){const p='public/'+kind+'-versao.json';const v=JSON.parse(fs.readFileSync(p,'utf8'));v.versao='2026.10.06.4';v.novidades=['Correção do envio de fotos','Interface mais minimalista'];fs.writeFileSync(p,JSON.stringify(v)+'\n');}
for(const p of fs.readdirSync('public').filter(p=>p.startsWith('cliente-')&&p.endsWith('.html'))){const path='public/'+p;fs.writeFileSync(path,fs.readFileSync(path,'utf8').replace(/2026\.10\.06\.[123]/g,'2026.10.06.4'));}
console.log('[cliente-clean-upload-v1] upload autenticado antes do parser geral; interface minimalista.');
