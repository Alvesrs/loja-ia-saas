const fs=require('node:fs');
function edit(p,fn){fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')))}
function replace(s,a,b){if(!s.includes(a))throw Error('Patch anchor missing: '+a.slice(0,60));return s.replace(a,b)}
fs.copyFileSync('patches/assets/owner-prospecting.service.js','src/services/ownerProspecting.service.js');
// LID -> phone resolution in WAHA NOWEB requires the Store feature. Enable it
// only on the SaintsAI owner's sessions; tenant sessions keep their current
// configuration and webhook behavior.
edit('src/services/wahaOnboarding.service.js',s=>{
 const helper=`function webhookConfig(e,ownerStore=false){const config={webhooks:[{url:e.publicBase+'/api/webhooks/waha',events:['message.any'],hmac:{key:e.hmac}}]};if(ownerStore)config.noweb={store:{enabled:true,fullSync:false}};return config;}\nasync function isOwnerStore(lojaId){const owner=String(process.env.SAINTSAI_OWNER_USER_ID||'').trim();if(!owner||!lojaId)return false;const {data,error}=await supabase.from('lojas').select('dono_id').eq('id',lojaId).maybeSingle();if(error)throw new ErroWaha('Não foi possível validar a sessão WhatsApp.',500);return data?.dono_id===owner;}\n`;
 if(!s.includes('function webhookConfig(e,ownerStore=false)')){
  const anchor='async function iniciarPareamento(lojaId,phoneNumber){';
  if(!s.includes(anchor))throw Error('Patch anchor missing: '+anchor);
  s=s.replace(anchor,helper+anchor);
 }
 let configCount=0;
 s=s.replace(/config\s*:\s*\{\s*webhooks\s*:\s*\[\s*\{\s*url\s*:\s*e\.publicBase\s*\+\s*['"]\/api\/webhooks\/waha['"]\s*,\s*events\s*:\s*\[\s*['"]message\.any['"]\s*\]\s*,\s*hmac\s*:\s*\{\s*key\s*:\s*e\.hmac\s*\}\s*\}\s*\]\s*\}/g,()=>{
  configCount++;
  return configCount===1?'config:webhookConfig(e,await isOwnerStore(lojaId))':'config:webhookConfig(e,await isOwnerStore(cfg.loja_id))';
 });
 s=s.replace(/\.select\(\s*['"]identificador_externo['"]\s*\)/,".select('identificador_externo,loja_id')");
 if(configCount!==2)throw Error('Expected two WAHA session configs, found '+configCount);
 return s;
});
for(const name of ['client-notifications','owner-prospecting'])fs.copyFileSync('patches/assets/'+name+'.js','public/js/'+name+'.js');
edit('src/routes/admin.routes.js',s=>replace(s,"router.post('/lojas/:lojaId/notificacao-teste'",`router.get('/prospeccao/minhas-lojas',exigirAdmin,async(req,res)=>{try{res.json({lojas:await require('../services/ownerProspecting.service').minhasLojas(req.usuario)});}catch(e){res.status(e.status||503).json({erro:e.status?e.message:'Não foi possível carregar suas lojas.'});}});
router.post('/prospeccao/autorizar',exigirAdmin,async(req,res)=>{try{res.json(await require('../services/ownerProspecting.service').autorizar(req.usuario,req.body||{}));}catch(e){res.status(e.status||503).json({erro:e.status?e.message:'Não foi possível autorizar este contato.'});}});
router.post('/lojas/:lojaId/notificacao-teste'`));
edit('src/services/whatsappAtendente.service.js',s=>replace(s,'  const respostaAgenda = await agendaWhatsapp.tentarResponder(mensagem);',`  if(!await require('./ownerProspecting.service').permitido(lojaId,contato))return null;
  const respostaAgenda = await agendaWhatsapp.tentarResponder(mensagem);`));
edit('src/controllers/whatsappWahaWebhook.controller.js',s=>{
 s=replace(s,"  if (!evento) return res.status(200).json({status:'sem_mensagem_processavel'});",`  if (!evento) return res.status(200).json({status:'sem_mensagem_processavel'});
  try{evento=await require('../services/ownerProspecting.service').normalizarEvento(evento);}catch(_){return res.status(503).json({erro:'Não foi possível validar o contato agora.'});}`);
 s=replace(s,'      const origemManual = evento.source',`      const controleDono=await require('../services/ownerProspecting.service').saidaDono(evento);
      if(controleDono)return res.status(200).json({status:controleDono});
      const origemManual = evento.source`);
 return replace(s,'    if (pedidoAudioDireto(evento.texto)) {',`    if(!await require('../services/ownerProspecting.service').eventoPermitido(evento))return res.status(200).json({status:'conversa_pessoal_ignorada'});
    if (pedidoAudioDireto(evento.texto)) {`);
});
edit('src/services/whatsappWorker.service.js',s=>replace(s,"      etapa = 'voz';",`      if(!await require('./ownerProspecting.service').permitido(mensagem.lojaId,mensagem.contato)){
        await idempotencia.concluirEventoWhatsapp({provedor:job.provedor,idExterno:job.id_externo});await fila.concluirJob(job.id);return Object.freeze({ok:true,id:job.id,silencioso:true});
      }
      etapa = 'voz';`));
edit('src/services/clientPush.service.js',s=>s.replace('module.exports={registrar,notificarLoja};',`async function validarConfiguracao(){await firebaseApp().options.credential.getAccessToken();return true;}
module.exports={registrar,notificarLoja,validarConfiguracao};`));
edit('src/server.js',s=>s+`\nrequire('./services/clientPush.service').validarConfiguracao().then(()=>console.info('[client-push] credencial_validada')).catch(()=>console.error('[client-push] credencial_indisponivel'));\n`);
edit('public/admin-prospeccao.html',s=>s.replace('</body>','<script src="js/owner-prospecting.js?v=2026.10.07.3"></script></body>').replace("$('cards').innerHTML='<div class=\"empty\">Falha na busca. Tente novamente.</div>'","$('cards').innerHTML='<div class=\"empty\">'+esc(e.message||'A fonte de contatos está indisponível agora. Tente novamente em alguns minutos.')+'</div>'"));
edit('public/cliente-central.html',s=>s.replace("    const token=String(window.AndroidClient.getPushToken","    if(typeof window.AndroidClient.notificationsEnabled==='function'&&!window.AndroidClient.notificationsEnabled())return;\n    const token=String(window.AndroidClient.getPushToken").replace('</body>','<script src="js/client-notifications.js?v=2026.10.07.5"></script></body>'));
edit('src/services/prospeccao.service.js',s=>{
 s=s.replace("async function geocodificar(cidade,uf){","const geoCache=new Map(),resultCache=new Map(),inflight=new Map();\nasync function geocodificar(cidade,uf){\n  const cacheKey=cidade.toLowerCase()+'|'+uf;const cached=geoCache.get(cacheKey);if(cached&&Date.now()-cached.time<86400000)return cached.value;");
 s=s.replace('{},10000)','{},6000)').replace('return {south:b[0],north:b[1],west:b[2],east:b[3],nome:item.display_name||cidade};',"const value={south:b[0],north:b[1],west:b[2],east:b[3],nome:item.display_name||cidade};if(geoCache.size>=200)geoCache.delete(geoCache.keys().next().value);geoCache.set(cacheKey,{time:Date.now(),value});return value;");
 const start=s.indexOf('async function buscarOverpass(query){'),end=s.indexOf('\nfunction normalizarLead',start);
 s=s.slice(0,start)+`async function buscarOverpass(query){
  const endpoints=['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter'];
  try{return await Promise.any(endpoints.map(ep=>fetchJson(ep,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(query)},12000).then(data=>{if(!Array.isArray(data?.elements)||data.remark)throw Error('Resposta incompleta da fonte');return data;})));}
  catch(_){throw Error('A fonte pública de contatos está temporariamente indisponível. Tente novamente em alguns minutos.');}
}
`+s.slice(end);
 s=s.replace('[timeout:20]','[timeout:10]').replace('out center tags 80','out center tags');
 s=s.replace('async function buscarProspeccao({uf,cidade,categoria}){','async function consultar({uf,cidade,categoria}){');
 s=s.replace('module.exports={buscarProspeccao,scoreLead,CATEGORIAS};',`async function buscarProspeccao(args){const key=[txt(args.uf).toUpperCase(),txt(args.cidade).toLowerCase(),txt(args.categoria).toLowerCase()].join('|');const old=resultCache.get(key);if(old&&Date.now()-old.time<600000)return old.value;if(inflight.has(key))return inflight.get(key);const work=consultar(args).then(value=>{if(resultCache.size>=100)resultCache.delete(resultCache.keys().next().value);resultCache.set(key,{time:Date.now(),value});return value;}).catch(e=>{if(old&&Date.now()-old.time<86400000)return {...old.value,cache:true,aviso:'Fonte temporariamente indisponível; exibindo a última consulta salva.'};throw e;}).finally(()=>inflight.delete(key));inflight.set(key,work);return work;}
module.exports={buscarProspeccao,scoreLead,CATEGORIAS};`);
 return s;
});
for(const type of ['admin','cliente']){const p='public/'+type+'-versao.json';if(fs.existsSync(p)){const v=JSON.parse(fs.readFileSync(p));v.versao='2026.10.07.5';v.novidades=['Busca resiliente, notificações e modo vendedor exclusivo do dono',...(v.novidades||[])];fs.writeFileSync(p,JSON.stringify(v,null,2));}}
console.log('Prospecção do dono e notificações v1 aplicadas.');
