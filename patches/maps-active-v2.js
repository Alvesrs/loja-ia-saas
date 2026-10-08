const fs=require('node:fs');
const edit=(p,a,b)=>{let s=fs.readFileSync(p,'utf8');if(!s.includes(a))throw Error('Missing anchor '+p);fs.writeFileSync(p,s.replace(a,b));};
edit('src/routes/admin.routes.js',"require('../services/osmProspecting.service').buscarProspeccao","(process.env.GOOGLE_MAPS_API_KEY?require('../services/mapsProspecting.service'):require('../services/osmProspecting.service')).buscarProspeccao");
let p='public/admin-prospeccao.html',s=fs.readFileSync(p,'utf8');
s=s.replaceAll('Buscar no mapa','Buscar comércios');
s=s.replace("document.querySelector('#maps-attribution').hidden=!String(r.origem||'').startsWith('OpenStreetMap');","document.querySelector('#maps-attribution').hidden=false;document.querySelector('#maps-attribution').textContent=r.origem==='Google Maps'?'Google Maps':'© OpenStreetMap contributors · Contatos públicos';");
s=s.replace('atribuicao:!',"fonte:$('maps-attribution').textContent,atribuicao:!").replace("$('maps-attribution').hidden=!v.atribuicao;","$('maps-attribution').hidden=!v.atribuicao;$('maps-attribution').textContent=v.fonte||'© OpenStreetMap contributors · Contatos públicos';");
fs.writeFileSync(p,s);
for(const t of ['admin','cliente']){p='public/'+t+'-versao.json';let d=JSON.parse(fs.readFileSync(p));d.versao='2026.10.08.5';fs.writeFileSync(p,JSON.stringify(d));}
const testFile='tests/prospeccao-static.test.js';let test=fs.readFileSync(testFile,'utf8');const old='Buscar clientes|Buscar no Maps|Buscar no mapa';if(test.includes(old))fs.writeFileSync(testFile,test.replace(old,old+'|Buscar comércios'));else if(!test.includes('Buscar comércios'))throw Error('Missing prospection label test anchor');
console.log('Google Maps selected automatically when configured');
