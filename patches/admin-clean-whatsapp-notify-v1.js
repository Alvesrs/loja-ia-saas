const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s);
for(const [a,b] of [['admin-clean.css','public/css/admin-clean.css'],['admin-notify.js','public/js/admin-notify.js']])fs.copyFileSync('patches/assets/'+a,b);
for(const name of ['admin-mobile.html','admin-cliente-cadastro.html','admin-cliente.html','admin-cliente-plano.html','admin-cliente-whatsapp.html','admin-prospeccao.html']){
 const p='public/'+name;if(!fs.existsSync(p))continue;let h=read(p);
 h=h.replace(/\\n(?=\s*<\/nav>)/g,'\n');
 h=h.replace(/js\/admin-central-saas\.js\?v=[^"]+/g,'js/admin-central-saas.js?v=2026.10.07.1');
 if(!h.includes('admin-clean.css'))h=h.replace('</head>','<link rel="stylesheet" href="css/admin-clean.css?v=2026.10.07.1"></head>');
 if(name==='admin-mobile.html'&&!h.includes('js/admin-notify.js'))h=h.replace('</body>','<script src="js/admin-notify.js?v=2026.10.07.1"></script></body>');
 if(name==='admin-prospeccao.html'){
  h=h.replace('x.telefone_exibicao?','(x.telefone_exibicao||x.telefone)?').replace('esc(x.telefone_exibicao)','esc(x.telefone_exibicao||x.telefone)');
  h=h.replace("document.querySelectorAll('[data-wa]').forEach(a=>a.onclick=e=>{e.preventDefault();window.location.href=a.href;});",`document.querySelectorAll('[data-wa]').forEach(a=>a.onclick=e=>{e.preventDefault();const phone=new URL(a.href).pathname.replace(/\\D/g,'');if(!/^55\\d{10,11}$/.test(phone))return;if(window.AndroidAgent&&typeof AndroidAgent.openWhatsApp==='function'){AndroidAgent.openWhatsApp(phone);return;}location.href='https://api.whatsapp.com/send?phone='+phone;});`);
  h=h.replace("st[b.dataset.id]=b.dataset.a;salvarEstado(st);render()","st[b.dataset.id]=b.dataset.a;salvarEstado(st);if(b.dataset.a==='descartado')ultimo=ultimo.filter(x=>x.id!==b.dataset.id);render()");
  h=h.replace('Escolha a cidade e a categoria.','Escolha a cidade e a categoria para buscar contatos.').replace('Encontre negócios com maior chance de aproveitar atendimento automático.','Contatos públicos da região para apresentar o SaintsAI.');
  h=h.replace('</style>',`.filters{grid-template-columns:100px minmax(0,1fr) minmax(0,1fr)!important}.filters .primary{grid-column:1/-1}.top{flex-direction:column;align-items:flex-start}.name{overflow-wrap:anywhere}.why{font-size:12px;line-height:1.6}.top3-label{border-radius:4px}.card{overflow:visible}.actions{grid-template-columns:repeat(3,minmax(0,1fr))}.tools{flex-wrap:wrap;align-items:flex-start}.status{flex:1;min-width:150px}.saved-filter{border-radius:6px}@media(max-width:650px){.filters{grid-template-columns:1fr!important}.actions{grid-template-columns:repeat(2,minmax(0,1fr))}.actions .danger{grid-column:1/-1}.head{gap:10px}.score{font-size:18px}.filters .primary{grid-column:auto}.tools{gap:12px}}
</style>`);
 }
 write(p,h);
}
let ui=read('public/js/admin-central-saas.js');
ui=ui.replace("</a></div></article>';}",`</a><button type="button" data-notificar-loja="'+esc(x.id)+'" data-loja-nome="'+esc(x.nome).replace(/"/g,'&quot;')+'">Testar notificação</button></div></article>';}`);
write('public/js/admin-central-saas.js',ui);
let routes=read('src/routes/admin.routes.js');
if(!routes.includes("'/lojas/:lojaId/notificacao-teste'"))routes=routes.replace('module.exports = router;',`
router.post('/lojas/:lojaId/notificacao-teste',exigirAdmin,async(req,res)=>{
 const titulo=typeof req.body?.titulo==='string'?req.body.titulo.trim():'';
 const mensagem=typeof req.body?.mensagem==='string'?req.body.mensagem.trim():'';
 if(!titulo||titulo.length>80||!mensagem||mensagem.length>500)return res.status(400).json({erro:'Informe título (até 80 caracteres) e mensagem (até 500 caracteres).'});
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.lojaId))return res.status(400).json({erro:'Loja inválida.'});
 try{
  const db=require('../config/supabase');
  const {data:loja,error}=await db.from('lojas').select('id').eq('id',req.params.lojaId).maybeSingle();if(error)throw error;if(!loja)return res.status(404).json({erro:'Loja não encontrada.'});
  const resultado=await require('../services/clientPush.service').notificarLoja(loja.id,{title:titulo,body:mensagem,tipo:'teste_venda'});
  return res.json({ok:true,...resultado});
 }catch(e){console.error('[admin-notificacao-teste]',e?.code||e?.message);return res.status(503).json({erro:'Não foi possível enviar a notificação agora. Tente novamente.'});}
});
module.exports = router;`);
write('src/routes/admin.routes.js',routes);
let push=read('src/services/clientPush.service.js');push=push.replace('return {enviados:0};','return {enviados:0,dispositivos:0};').replace('return {enviados};','return {enviados,dispositivos:devices.length};');write('src/services/clientPush.service.js',push);
write('public/admin-versao.json',JSON.stringify({versao:'2026.10.07.1',novidades:['Painel minimalista e responsivo','Abrir WhatsApp fora do aplicativo','Notificação personalizada de teste por loja']})+'\n');
let updater=read('public/js/admin-atualizacao.js').replace(/Versão \d{4}\.\d{2}\.\d{2}\.\d+/g,'Versão 2026.10.07.1');write('public/js/admin-atualizacao.js',updater);
console.log('SaintsAI Agente: interface, WhatsApp e testes de notificação aplicados.');
