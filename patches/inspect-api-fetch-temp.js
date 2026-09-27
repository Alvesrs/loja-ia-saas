const fs=require('node:fs');
const candidates=['public/js/api.js','public/js/auth.js','public/js/config.js'];
for(const p of candidates){
 if(!fs.existsSync(p))continue;
 const s=fs.readFileSync(p,'utf8');
 const i=s.indexOf('apiFetch');
 if(i>=0)console.log('[API_FETCH_SOURCE]',p,'\n'+s.slice(Math.max(0,i-800),i+5000));
}
if(fs.existsSync('src/app.js')){
 const a=fs.readFileSync('src/app.js','utf8');
 const marks=['express.json','clienteHubRoutes','/api/lojas/:lojaId/cliente-hub','app.use'];
 for(const m of marks){const i=a.indexOf(m);console.log('[APP_ORDER]',m,i,i>=0?a.slice(Math.max(0,i-900),i+1800):'');}
}
