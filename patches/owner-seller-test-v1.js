const fs=require('node:fs');
function edit(p,fn){fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));}function swap(s,a,b){if(!s.includes(a))throw Error('Missing test patch anchor '+a.slice(0,60));return s.replace(a,b);}
for(const [a,b] of [['owner-seller-test.service.js','src/services/ownerSellerTest.service.js'],['admin-vendedor-teste.html','public/admin-vendedor-teste.html'],['owner-seller-test.js','public/js/owner-seller-test.js']])fs.copyFileSync('patches/assets/'+a,b);
edit('src/routes/admin.routes.js',s=>swap(s,"router.get('/notificacoes/dispositivos'",`router.get('/vendedor-teste',exigirAdmin,(req,res)=>{res.set('Cache-Control','no-store');try{res.json(require('../services/ownerSellerTest.service').info(req.usuario));}catch(e){res.status(e.status||503).json({erro:e.status?e.message:'Teste indisponível.'});}});
router.post('/vendedor-teste/reiniciar',exigirAdmin,require('../middleware/rateLimiter').criarRateLimiter({janelaMs:60000,maxRequisicoes:10,mensagem:'Aguarde um instante antes de reiniciar novamente.'}),async(req,res)=>{res.set('Cache-Control','no-store');try{res.json(await require('../services/ownerSellerTest.service').restart(req.usuario,req.body||{}));}catch(e){res.status(e.status||503).json({erro:e.status?e.message:'Não foi possível reiniciar o teste. Tente novamente.'});}});
router.get('/notificacoes/dispositivos'`));
edit('src/services/ownerSalesOnboarding.service.js',s=>swap(s,"const input=text(args.pergunta).toLowerCase();",`if(require('./ownerSellerTest.service').isTest(c))return require('./ownerSellerTest.service').handle(args,c);
 const input=text(args.pergunta).toLowerCase();`));
edit('src/services/ownerSalesOnboarding.service.js',s=>swap(s,"if(c?.lead_status==='prompt_pronta'){",`if(require('./ownerSellerTest.service').isTest(c))return c.lead_status==='prompt_pronta'?require('./ownerSellerTest.service').offer():response;if(c?.lead_status==='prompt_pronta'){`));
edit('src/services/salesSeller.service.js',s=>{s=swap(s,'async function iniciarBriefing(lojaId,contato){',`async function iniciarBriefing(lojaId,contato){
  const previous=await obterLead(lojaId,contato),b=previous?.briefing||{};
  const testBriefing=b.__saintsai_test?{__saintsai_test:true,__test_started:b.__test_started,__test_run:b.__test_run}:{};`);s=swap(s,"briefing_step:0,briefing:{},prompt_rascunho", "briefing_step:0,briefing:testBriefing,prompt_rascunho");
 s=swap(s,"const {data:msgs,error:e2}=await supabase.from('whatsapp_mensagens')",`const testSince=await require('./ownerSellerTest.service').since(lojaId,contato);
  let historyQuery=supabase.from('whatsapp_mensagens')`);s=swap(s,"    .limit(12);\n  if(e2",`    .limit(12);
  if(testSince)historyQuery=historyQuery.gte('criado_em',testSince);
  const {data:msgs,error:e2}=await historyQuery;
  if(e2`);
 s=swap(s,"const {data,error}=await supabase.from('whatsapp_mensagens')\n    .select('texto,criado_em')",`const testSince=await require('./ownerSellerTest.service').since(lojaId,contato);
  let outputQuery=supabase.from('whatsapp_mensagens')
    .select('texto,criado_em')`);s=swap(s,".limit(4);\n  if(error",`.limit(4);
  if(testSince)outputQuery=outputQuery.gte('criado_em',testSince);
  const {data,error}=await outputQuery;
  if(error`);return s;});
edit('src/services/whatsappWorker.service.js',s=>{const check=`if(await require('./ownerSellerTest.service').stale(job)){await idempotencia.concluirEventoWhatsapp({provedor:job.provedor,idExterno:job.id_externo});await fila.concluirJob(job.id);return Object.freeze({ok:true,id:job.id,silencioso:true});}`;s=swap(s,"etapa = 'atendente';",check+"\n      etapa = 'atendente';");return swap(s,"etapa = 'voz';",check+"\n      etapa = 'voz';");});
edit('public/admin-mobile.html',s=>swap(s,'<a href="admin-prospeccao.html">', '<a href="admin-vendedor-teste.html">🧪 Teste do vendedor</a><a href="admin-prospeccao.html">'));
edit('public/admin-prospeccao.html',s=>swap(s,'</body>','<a href="admin-vendedor-teste.html" style="display:block;padding:20px;color:#c4a5ff;text-align:center">🧪 Abrir teste do vendedor</a></body>'));
for(const kind of ['admin','cliente']){const p='public/'+kind+'-versao.json';const v=JSON.parse(fs.readFileSync(p));v.versao='2026.10.08.3';v.novidades=['Nova aba Teste do vendedor: reinício da conversa e contratação simulada'];fs.writeFileSync(p,JSON.stringify(v,null,2));}
console.log('Teste do vendedor com isolamento de cobranças instalado.');
