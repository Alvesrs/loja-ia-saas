const fs=require('node:fs');
function edit(p,fn){fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));}function swap(s,a,b){if(!s.includes(a))throw Error('Owner agent missing anchor '+a.slice(0,80));return s.replace(a,b);}
for(const [a,b] of [['owner-agent.service.js','src/services/ownerAgent.service.js'],['owner-product-lab.service.js','src/services/ownerProductLab.service.js'],['admin-agente-dono.html','public/admin-agente-dono.html'],['owner-agent.js','public/js/owner-agent.js']])fs.copyFileSync('patches/assets/'+a,b);
edit('src/routes/admin.routes.js',s=>swap(s,"router.get('/vendedor-teste',",`router.get('/agente-dono',exigirAdmin,async(req,res)=>{res.set('Cache-Control','no-store');try{res.json(await require('../services/ownerAgent.service').status(req.usuario));}catch(e){res.status(e.status||503).json({erro:e.status?e.message:'Não foi possível carregar o Agente dono.'});}});
router.put('/agente-dono',exigirAdmin,async(req,res)=>{try{res.json(await require('../services/ownerAgent.service').activate(req.usuario,req.body||{}));}catch(e){res.status(e.status||503).json({erro:e.status?e.message:'Não foi possível salvar o Agente dono.'});}});
router.get('/vendedor-teste',`));
edit('src/services/ownerSellerTest.service.js',s=>{
 s=swap(s,"const started=new Date().toISOString(),briefing={", "const started=new Date().toISOString(),briefing={__test_signature:require('./ownerProductLab.service').signature(lojaId,contato,requestId),");
 s=swap(s,'resposta:INTRO}',"resposta:require('./ownerProductLab.service').INTRO}");
 s=swap(s,"if(!isTest(c))return {handled:false};", `if(!isTest(c))return {handled:false};
 const lab=await require('./ownerProductLab.service').handle(args,c);if(lab.handled)return lab;`);
 s=swap(s,"function info(usuario){if(usuario?.id!==process.env.SAINTSAI_OWNER_USER_ID)","function info(usuario){if(!require('./ownerAgent.service').authorized(usuario))");
 s=swap(s,"if(!process.env.SAINTSAI_OWNER_USER_ID||usuario?.id!==process.env.SAINTSAI_OWNER_USER_ID)","if(!require('./ownerAgent.service').authorized(usuario))");
 return s;
});
edit('src/services/whatsappAtendente.service.js',s=>swap(s,'  let contextoComercialAutomacao=false;',`  if(vendaAtiva){const lab=await require('./ownerProductLab.service').tryHandle({lojaId,contato,pergunta:texto});if(lab.handled)return Object.freeze({lojaId,contato,idExterno,pergunta:texto,resposta:lab.response,productLab:true});}
  let contextoComercialAutomacao=false;`));
edit('src/services/whatsappWorker.service.js',s=>swap(s,'(resposta.prospectAutomation||resposta.salesRefusal)','(resposta.prospectAutomation||resposta.salesRefusal||resposta.productLab)'));
edit('public/admin-mobile.html',s=>swap(s,'</body>','<script src="js/owner-agent.js?v=2026.10.09.1"></script></body>'));
edit('public/admin-vendedor-teste.html',s=>s.replace(/Teste do vendedor/g,'Laboratório do produto').replace('Recomece a conversa do zero para experimentar a abordagem e a contratação.','Seu assistente de testes demonstra agendamento, venda, pagamento, galeria e outras funções do SaintsAI.').replace('Seu WhatsApp vendedor','Seu WhatsApp de demonstração').replace('O agente envia uma nova apresentação a cada reinício.','Diga “vamos testar agendamento” ou “simular venda”. O agente auxilia seus testes, sem tratar você como um prospectado.').replace('js/owner-seller-test.js"','js/owner-seller-test.js?v=2026.10.09.1"'));
edit('public/js/owner-seller-test.js',s=>s.replace('Novo teste iniciado. Responda à apresentação no WhatsApp.','Novo teste iniciado. Laboratório pronto: diga qual função quer testar.'));
for(const kind of ['admin','cliente']){const p='public/'+kind+'-versao.json';const v=JSON.parse(fs.readFileSync(p));v.versao='2026.10.09.1';v.novidades=['Agente dono exclusivo e laboratório de demonstração no número de teste'];fs.writeFileSync(p,JSON.stringify(v,null,2));}
console.log('Agente dono e laboratório do produto instalados.');
