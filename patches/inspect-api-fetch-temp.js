const fs=require('node:fs');
const candidates=['public/js/api.js','public/js/auth.js','public/js/config.js'];
for(const p of candidates){
 if(!fs.existsSync(p))continue;
 const s=fs.readFileSync(p,'utf8');
 const i=s.indexOf('apiFetch');
 if(i>=0)console.log('[API_FETCH_SOURCE]',p,'\n'+s.slice(Math.max(0,i-800),i+5000));
}