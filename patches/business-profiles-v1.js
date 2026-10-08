const fs=require('fs');const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));const replace=(s,a,b)=>{if(!s.includes(a))throw Error('Missing profile anchor '+a);return s.replace(a,b);};
fs.copyFileSync('patches/assets/business-profiles.service.js','src/services/businessProfiles.service.js');
fs.copyFileSync('patches/assets/cliente-business-profile.js','public/js/cliente-business-profile.js');
edit('src/services/salesSeller.service.js',s=>{s=replace(s,'const atual=CAMPOS_BRIEFING[step];',"const campos=require('./businessProfiles.service').fields(CAMPOS_BRIEFING,lead.briefing||{});\n  const atual=campos[step];");s=replace(s,'if(proximo<CAMPOS_BRIEFING.length){',"const seguintes=require('./businessProfiles.service').fields(CAMPOS_BRIEFING,briefing);\n  if(proximo<seguintes.length){");s=replace(s,'return CAMPOS_BRIEFING[proximo].pergunta;','return seguintes[proximo].pergunta;');return s;});
edit('src/services/prospeccao.service.js',s=>replace(s,'  barbearia: {',"  roupas:{label:'Loja de roupas',base:74,motivo:'Catálogo, tamanhos, disponibilidade e imagens por WhatsApp.',filtros:[['shop','clothes']]},\n  barbearia: {"));
edit('public/admin-prospeccao.html',s=>replace(s,'<option value="barbearia">','<option value="roupas">Loja de roupas</option><option value="barbearia">'));
for(const p of ['public/cliente-central.html','public/cliente-galeria.html'])edit(p,s=>replace(s,'</body>','<script src="js/cliente-business-profile.js?v=2026.10.08.6"></script></body>'));
for(const t of ['admin','cliente'])edit('public/'+t+'-versao.json',s=>{const d=JSON.parse(s);d.versao='2026.10.08.6';return JSON.stringify(d)});
console.log('Business profiles and tailored registration ready');
