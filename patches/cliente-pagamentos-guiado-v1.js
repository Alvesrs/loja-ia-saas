const fs=require('node:fs'),cp=require('node:child_process');
for(const [a,b] of [['asaasOnboarding.service.js','src/services/asaasOnboarding.service.js'],['cliente-pagamentos-guiado.js','public/js/cliente-pagamentos-guiado.js'],['cliente-pagamentos-guiado.css','public/css/cliente-pagamentos-guiado.css']])fs.copyFileSync('patches/assets/'+a,b);
let html=fs.readFileSync('public/cliente-configuracao.html','utf8');
html=html.replace(/function renderPagamentos\(\)\{[\s\S]*?(?=function renderAgenda\()/,'function renderPagamentos(){window.SaintsAIPagamentos.render();}\n');
if(!html.includes('js/cliente-pagamentos-guiado.js'))html=html.replace('<script src="js/loja.js"></script>','<script src="js/loja.js"></script><script src="js/cliente-pagamentos-guiado.js?v=2026.10.04.3"></script>');
if(!html.includes('css/cliente-pagamentos-guiado.css'))html=html.replace('</head>','<link rel="stylesheet" href="css/cliente-pagamentos-guiado.css?v=2026.10.04.3"></head>');fs.writeFileSync('public/cliente-configuracao.html',html);
let sub=fs.readFileSync('src/services/asaasSubconta.service.js','utf8');
sub=sub.replace('fetch(c.base+path,','fetch((apiKey.startsWith(\'$aact_hmlg_\')?\'https://api-sandbox.asaas.com\':apiKey.startsWith(\'$aact_prod_\')?\'https://api.asaas.com\':c.base)+path,');
if(!sub.includes('signal:AbortSignal.timeout(15000)'))sub=sub.replace("method:opt.method||'GET',headers", "signal:AbortSignal.timeout(15000),method:opt.method||'GET',headers");
sub=sub.replace("catch(_){}if(!sec.apiKey)","catch(_){sec={apiKey:String(data||'')};}if(!sec.apiKey)");
sub=sub.replace("mensagemFinal='Subconta Asaas criada. O titular deve concluir a ativação e validação recebidas por e-mail.'","mensagemFinal='Conta criada e conectada. Conclua a validação solicitada pelo Asaas antes de iniciar os recebimentos.'");
sub=sub.replace("aceita_pix_online:true,atualizado_em:new Date().toISOString()","aceita_pix_online:statusFinal==='SUBCONTA_APROVADA_SANDBOX',atualizado_em:new Date().toISOString()");
fs.writeFileSync('src/services/asaasSubconta.service.js',sub);
let ctl=fs.readFileSync('src/controllers/asaasSubconta.controller.js','utf8');
if(!ctl.includes('asaasOnboarding.service'))ctl="const guided=require('../services/asaasOnboarding.service');\n"+ctl;
if(!ctl.includes('Confirme a autorização para enviar o cadastro'))ctl=ctl.replace('const body={...req.body,name:',"if(req.body?.consentimento!==true)return res.status(400).json({erro:'Confirme a autorização para enviar o cadastro ao Asaas.'});const body={...req.body,name:");
ctl=ctl.replace('svc.criarSubconta(loja.id,body)','guided.create(loja.id,body)');
ctl=ctl.replace('return res.json(await svc.status(loja.id))',"res.set('Cache-Control','no-store');return res.json(await guided.status(loja.id))");
if(!ctl.includes('async function conectar'))ctl=ctl.replace('module.exports={status,criar};',`async function conectar(req,res){try{const loja=await acesso(String(req.params.lojaId||''),req.usuario);if(!loja)return res.status(403).json({erro:'Você não tem acesso a essa loja.'});if(req.body?.consentimento!==true)return res.status(400).json({erro:'Confirme a autorização para conectar sua conta.'});return res.json(await guided.connect(loja.id,req.body));}catch(e){const messages={chave_email_invalidos:'Informe sua chave de API e um e-mail válido.',asaas_nao_configurado:'A integração do SaintsAI está indisponível. Tente novamente mais tarde.',ambiente_incompativel:'A chave pertence a outro ambiente. Use a conta indicada nesta tela.',conta_ja_conectada:'Esta empresa já possui uma conta conectada. Atualize a situação antes de continuar.',conexao_em_andamento:'A conexão já está em andamento. Aguarde.',webhook_nao_confirmado:'Não foi possível confirmar a integração dos pagamentos. Tente novamente.'};const msg=messages[e.message]||(e.status===401?'Chave recusada pelo Asaas. Confira se ela está ativa.':e.status===403?'O Asaas bloqueou a integração. Verifique as permissões e pendências da conta.':'Não foi possível conectar agora. Confira sua chave, suas permissões e tente novamente.');return res.status(e.status===401||e.status===403||messages[e.message]?400:502).json({erro:msg});}}
module.exports={status,criar,conectar};`);fs.writeFileSync('src/controllers/asaasSubconta.controller.js',ctl);
let routes=fs.readFileSync('src/routes/asaasSubconta.routes.js','utf8');if(!routes.includes('/conectar'))routes=routes.replace('module.exports=r;',"r.post('/lojas/:lojaId/conectar',exigirLogin,c.conectar);\nmodule.exports=r;");fs.writeFileSync('src/routes/asaasSubconta.routes.js',routes);
let hub=fs.readFileSync('src/controllers/clienteHub.controller.js','utf8');
if(!hub.includes('SAINTSAI_PRESERVE_PAYMENT_CONNECTION')){
 hub=hub.replace("const payload={loja_id:loja.id,provedor,conectado:false,aceita_pix_online",`// SAINTSAI_PRESERVE_PAYMENT_CONNECTION
    const {data:atualPagamento,error:erroAtual}=await supabase.from('saintsai_pagamento_config').select('provedor,conectado').eq('loja_id',loja.id).maybeSingle();if(erroAtual)throw erroAtual;
    if(atualPagamento?.conectado&&atualPagamento.provedor!==provedor)return res.status(400).json({erro:'Desconecte a conta atual antes de trocar o provedor.'});
    const payload={loja_id:loja.id,provedor,conectado:Boolean(atualPagamento?.conectado&&atualPagamento.provedor===provedor),aceita_pix_online`);
 hub=hub.replace("p_secret:chave","p_secret:JSON.stringify({apiKey:chave})");
 hub=hub.replace("select('provedor,conectado,aceita_pix_online,aceita_pix_presencial,aceita_dinheiro,aceita_cartao_presencial')","select('provedor,conectado,provedor_status,aceita_pix_online,aceita_pix_presencial,aceita_dinheiro,aceita_cartao_presencial')");
 hub=hub.replace("concluida:Boolean(pag?.conectado&&pag?.provedor==='pagbank')","concluida:Boolean(pag?.conectado&&pag?.provedor==='asaas'&&['APPROVED','SUBCONTA_APROVADA_SANDBOX'].includes(pag?.provedor_status))");
 fs.writeFileSync('src/controllers/clienteHub.controller.js',hub);
}
fs.writeFileSync('public/cliente-versao.json',JSON.stringify({versao:'2026.10.04.3',publicado_em:'2026-10-04',novidades:['Cadastro Asaas guiado','Conexão de conta existente','Pendências e aprovação da conta','Formas de pagamento preservam a conexão']})+'\n');
for(const p of ['public/js/cliente-pagamentos-guiado.js','src/services/asaasOnboarding.service.js','src/services/asaasSubconta.service.js','src/controllers/asaasSubconta.controller.js','src/controllers/clienteHub.controller.js'])cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
console.log('[cliente-pagamentos-guiado-v1] cadastro, conexão e situação cadastral configurados.');
