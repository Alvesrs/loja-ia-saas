const fs=require('node:fs');
const path=require('node:path');
const municipios=require('../src/services/municipios-br');
if(!Array.isArray(municipios)||municipios.length<5000)throw Error('Base de municípios brasileiros incompleta.');
const cidades=municipios.map(([uf,nome])=>[uf,nome]).sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1],'pt-BR',{sensitivity:'base'}));
fs.writeFileSync(path.join('public','js','municipios-br.js'),'// Municípios brasileiros; fonte: kelvins/municipios-brasileiros (MIT).\nwindow.SAINTSAI_MUNICIPIOS='+JSON.stringify(cidades)+';\n');
const edit=(p,a,b)=>{let s=fs.readFileSync(p,'utf8');if(!s.includes(a)){if(s.includes(b))return;throw Error('Missing anchor '+p);}fs.writeFileSync(p,s.replace(a,b));};
edit('src/routes/admin.routes.js',"require('../services/osmProspecting.service').buscarProspeccao","(process.env.GOOGLE_MAPS_API_KEY?require('../services/mapsProspecting.service'):require('../services/osmProspecting.service')).buscarProspeccao");
let p='public/admin-prospeccao.html',s=fs.readFileSync(p,'utf8');
s=s.replaceAll('Buscar no mapa','Buscar comércios');
s=s.replace("document.querySelector('#maps-attribution').hidden=!String(r.origem||'').startsWith('OpenStreetMap');","document.querySelector('#maps-attribution').hidden=false;document.querySelector('#maps-attribution').textContent=r.origem==='Google Maps'?'Google Maps':'© OpenStreetMap contributors · Contatos públicos';");
s=s.replace('atribuicao:!',"fonte:$('maps-attribution').textContent,atribuicao:!").replace("$('maps-attribution').hidden=!v.atribuicao;","$('maps-attribution').hidden=!v.atribuicao;$('maps-attribution').textContent=v.fonte||'© OpenStreetMap contributors · Contatos públicos';");
fs.writeFileSync(p,s);
for(const t of ['admin','cliente']){p='public/'+t+'-versao.json';let d=JSON.parse(fs.readFileSync(p));d.versao='2026.10.08.6';fs.writeFileSync(p,JSON.stringify(d));}
let page='public/admin-prospeccao.html',html=fs.readFileSync(page,'utf8');
html=html.replace('<input id="cidade" placeholder="Ex.: Londrina" autocomplete="address-level2">','<input id="cidade" placeholder="Digite para buscar uma cidade" list="cidades-disponiveis" autocomplete="address-level2"><datalist id="cidades-disponiveis"></datalist>');
html=html.replace('js/api.js?v=2026.10.07.13"></script>','js/api.js?v=2026.10.07.13"></script>\n<script src="js/municipios-br.js?v=2026.10.08.6"></script>');
html=html.replace("const $=id=>document.getElementById(id);","const $=id=>document.getElementById(id);\nfunction popularCidades(selecionada=''){const lista=$('cidades-disponiveis'),uf=$('uf').value;lista.replaceChildren();const nomes=(window.SAINTSAI_MUNICIPIOS||[]).filter(x=>x[0]===uf).map(x=>x[1]).sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}));for(const nome of nomes){const option=document.createElement('option');option.value=nome;lista.append(option)}$('cidade').value=selecionada&&nomes.some(x=>x.localeCompare(selecionada,'pt-BR',{sensitivity:'base'})===0)?selecionada:'';}\n$('uf').addEventListener('change',()=>{ $('cidade').value=''; popularCidades(); });");
html=html.replace("$('uf').value=v.uf;$('cidade').value=v.cidade;$('categoria').value=v.categoria;","$('uf').value=v.uf;popularCidades(v.cidade);$('categoria').value=v.categoria;");
html=html.replace('restaurarBusca();\n</script>','popularCidades();\nrestaurarBusca();\n</script>');
fs.writeFileSync(page,html);
const testFile='tests/prospeccao-static.test.js';let test=fs.readFileSync(testFile,'utf8');const old='Buscar clientes|Buscar no Maps|Buscar no mapa';if(!test.includes('Buscar comércios')){if(!test.includes(old))throw Error('Missing prospection label test anchor');fs.writeFileSync(testFile,test.replace(old,old+'|Buscar comércios'));}
console.log('Google Maps selected automatically when configured');
