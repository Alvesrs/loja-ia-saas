const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

fs.copyFileSync('patches/assets/servicoImagem.controller.js','src/controllers/servicoImagem.controller.js');
fs.copyFileSync('patches/assets/servicoImagem.routes.js','src/routes/servicoImagem.routes.js');
fs.copyFileSync('patches/assets/cliente-dashboard-polish-v3.css','public/css/cliente-dashboard-polish-v3.css');
fs.copyFileSync('patches/assets/cliente-dashboard-polish-v3.js','public/js/cliente-dashboard-polish-v3.js');
fs.copyFileSync('patches/assets/cliente-config-polish-v3.js','public/js/cliente-config-polish-v3.js');

let app=read('src/app.js');
if(!app.includes("const servicoImagemRoutes = require('./routes/servicoImagem.routes');")){
  const a="const produtoImagemRoutes = require('./routes/produtoImagem.routes');";
  if(!app.includes(a))throw new Error('Require produtoImagemRoutes não encontrado');
  app=app.replace(a,a+"\nconst servicoImagemRoutes = require('./routes/servicoImagem.routes');");
}
if(!app.includes("app.use('/api/lojas/:lojaId/servico-imagem', servicoImagemRoutes);")){
  const a="app.use('/api/lojas/:lojaId/produto-imagem', produtoImagemRoutes);";
  if(!app.includes(a))throw new Error('Mount produto-imagem não encontrado');
  app=app.replace(a,a+"\napp.use('/api/lojas/:lojaId/servico-imagem', servicoImagemRoutes);");
}
write('src/app.js',app);

let c=read('src/controllers/clienteHub.controller.js');
const createOld="const {data,error}=await supabase.from('saintsai_servicos').insert({loja_id:loja.id,nome,descricao:String(req.body?.descricao||'').trim()||null,preco,duracao_min:duracao,intervalo_pos_min:intervalo,ativo:true}).select('*').single();";
if(c.includes(createOld)){
  c=c.replace(createOld,"const imagemUrl=req.body?.imagem_url?String(req.body.imagem_url).trim().slice(0,2048):null;const imagemPath=req.body?.imagem_path?String(req.body.imagem_path).trim().slice(0,512):null;\n    const {data,error}=await supabase.from('saintsai_servicos').insert({loja_id:loja.id,nome,descricao:String(req.body?.descricao||'').trim()||null,preco,duracao_min:duracao,intervalo_pos_min:intervalo,imagem_url:imagemUrl,imagem_path:imagemPath,ativo:true}).select('*').single();");
}
const upd="if(req.body?.ativo!==undefined)dados.ativo=Boolean(req.body.ativo);";
if(c.includes(upd)&&!c.includes('dados.imagem_url=')){
  c=c.replace(upd,"if(req.body?.imagem_url!==undefined){const v=req.body.imagem_url===null?null:String(req.body.imagem_url||'').trim();if(v&&v.length>2048)return res.status(400).json({erro:'URL da foto inválida.'});dados.imagem_url=v||null;}\n    if(req.body?.imagem_path!==undefined){const v=req.body.imagem_path===null?null:String(req.body.imagem_path||'').trim();if(v&&v.length>512)return res.status(400).json({erro:'Caminho da foto inválido.'});dados.imagem_path=v||null;}\n    "+upd);
}

if(!c.includes('async function salvarEquipe(req,res){')){
  const p=c.indexOf('function removerBlocoPrompt(texto,inicio,fim){');
  if(p<0)throw new Error('Ponto para inserir equipe não encontrado');
  const fn=[
    "async function salvarEquipe(req,res){",
    "  try{",
    "    const loja=await exigirLoja(req,res);if(!loja)return;",
    "    const quantidade=Number(req.body?.quantidade_profissionais);",
    "    if(!Number.isInteger(quantidade)||quantidade<1||quantidade>100)return res.status(400).json({erro:'Informe quantos profissionais atendem no local.'});",
    "    const {data:atual,error:ea}=await supabase.from('saintsai_agenda_config').select('*').eq('loja_id',loja.id).maybeSingle();",
    "    if(ea)throw ea;",
    "    const payload={loja_id:loja.id,timezone:atual?.timezone||'America/Sao_Paulo',intervalo_grade_min:Number(atual?.intervalo_grade_min||30),horarios:atual?.horarios||{},lembrete_24h:atual?.lembrete_24h!==false,lembrete_2h:atual?.lembrete_2h!==false,quantidade_profissionais:quantidade,atualizado_em:new Date().toISOString()};",
    "    const {data,error}=await supabase.from('saintsai_agenda_config').upsert(payload,{onConflict:'loja_id'}).select('*').single();",
    "    if(error)throw error;",
    "    return res.json(data);",
    "  }catch(e){console.error('[cliente-hub] equipe',e?.message||e);return res.status(500).json({erro:'Não foi possível salvar a equipe.'});}",
    "}",
    ""
  ].join('\n');
  c=c.slice(0,p)+fn+c.slice(p);
}

{
  const a=c.indexOf('async function onboardingCliente(req,res){');
  const b=c.indexOf('\nasync function inicioCliente(req,res){',a);
  if(a<0||b<0)throw new Error('onboardingCliente não encontrado');
  const fn=[
    "async function onboardingCliente(req,res){",
    "  try{",
    "    const loja=await exigirLoja(req,res);if(!loja)return;",
    "    const lojaId=loja.id;",
    "    const [{data:servicos,error:e1},{data:agendaCfg,error:e2},{data:pag,error:e3},{data:wa,error:e4}]=await Promise.all([",
    "      supabase.from('saintsai_servicos').select('id,nome,preco,imagem_url,ativo').eq('loja_id',lojaId).eq('ativo',true),",
    "      supabase.from('saintsai_agenda_config').select('horarios,quantidade_profissionais').eq('loja_id',lojaId).maybeSingle(),",
    "      supabase.from('saintsai_pagamento_config').select('provedor,conectado').eq('loja_id',lojaId).maybeSingle(),",
    "      supabase.from('whatsapp_configuracoes').select('id,ativo').eq('loja_id',lojaId).eq('ativo',true).limit(1)",
    "    ]);",
    "    if(e1||e2||e3||e4)throw (e1||e2||e3||e4);",
    "    const trabalhoOk=(servicos||[]).some(s=>s.nome&&Number.isFinite(Number(s.preco))&&Boolean(s.imagem_url));",
    "    const equipeOk=Number(agendaCfg?.quantidade_profissionais||0)>=1;",
    "    const horarios=agendaCfg?.horarios||{};",
    "    const agendaOk=Object.values(horarios).some(x=>x&&x.aberto===true&&x.inicio&&x.fim);",
    "    const pagbankOk=Boolean(pag&&pag.provedor==='pagbank'&&pag.conectado===true);",
    "    const whatsappOk=Boolean(wa&&wa.length);",
    "    const etapas=[",
    "      {id:'servicos',titulo:'Cadastre seu trabalho',descricao:'Adicione uma foto, o nome do serviço e o preço.',concluida:trabalhoOk,destino:'servicos'},",
    "      {id:'equipe',titulo:'Configure sua equipe',descricao:'Informe quantos profissionais atendem no local.',concluida:equipeOk,destino:'equipe'},",
    "      {id:'agenda',titulo:'Configure seus horários',descricao:'Defina dias e horários de atendimento.',concluida:agendaOk,destino:'agenda'},",
    "      {id:'pagamentos',titulo:'Conecte o PagBank',descricao:'Conecte sua conta para receber pagamentos online.',concluida:pagbankOk,destino:'pagamentos'},",
    "      {id:'operacao',titulo:'Conecte o WhatsApp',descricao:'Ative o número que receberá os clientes.',concluida:whatsappOk,destino:'operacao'}",
    "    ];",
    "    const concluidas=etapas.filter(x=>x.concluida).length;",
    "    const percentual=Math.round((concluidas/etapas.length)*100);",
    "    const proxima=etapas.find(x=>!x.concluida)||null;",
    "    return res.json({percentual,concluidas,total:etapas.length,etapas,proxima:proxima?.id||null,pronto:percentual===100});",
    "  }catch(e){console.error('[cliente-hub] onboarding',e?.message||e);return res.status(500).json({erro:'Não foi possível carregar o progresso da configuração.'});}",
    "}",
    ""
  ].join('\n');
  c=c.slice(0,a)+fn+c.slice(b);
}

{
  const a=c.indexOf('async function inicioCliente(req,res){');
  const b=c.indexOf('\nasync function salvarEquipe(req,res){',a);
  if(a<0||b<0)throw new Error('inicioCliente não encontrado');
  const fn=[
    "async function inicioCliente(req,res){",
    "  try{",
    "    const loja=await exigirLoja(req,res);if(!loja)return;",
    "    const hojeSP=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());",
    "    const inicioHoje=new Date(hojeSP+'T00:00:00-03:00');",
    "    const fimHoje=new Date(hojeSP+'T23:59:59.999-03:00');",
    "    const [{data:hoje,error:e1},{data:recentes,error:e2}]=await Promise.all([",
    "      supabase.from('saintsai_agendamentos').select('id,cliente_nome,inicio,valor,status,pagamento_status,criado_em,saintsai_servicos(nome,imagem_url)').eq('loja_id',loja.id).gte('inicio',inicioHoje.toISOString()).lte('inicio',fimHoje.toISOString()).order('inicio',{ascending:true}),",
    "      supabase.from('saintsai_agendamentos').select('id,cliente_nome,inicio,valor,status,pagamento_status,criado_em,saintsai_servicos(nome,imagem_url)').eq('loja_id',loja.id).order('criado_em',{ascending:false}).limit(20)",
    "    ]);",
    "    if(e1||e2)throw (e1||e2);",
    "    const validosHoje=(hoje||[]).filter(x=>x.status!=='cancelado');",
    "    const vendasHoje=validosHoje.reduce((a,x)=>a+Number(x.valor||0),0);",
    "    const mapa=x=>({id:x.id,nome:x.cliente_nome||'Cliente',inicio:x.inicio,criado_em:x.criado_em,servico:x.saintsai_servicos?.nome||'Atendimento',imagem_url:x.saintsai_servicos?.imagem_url||null,valor:Number(x.valor||0),status:x.status,pagamento_status:x.pagamento_status});",
    "    return res.json({clientes_hoje:validosHoje.length,vendas_hoje:vendasHoje,registros:(recentes||[]).map(mapa),hoje:{clientes:validosHoje.map(mapa),total:vendasHoje,previstos:vendasHoje,quantidade:validosHoje.length},mes:{previsto:0,recebido:0,quantidade:0},fechamento:{recebido:0,pendente:0,total:0}});",
    "  }catch(e){console.error('[cliente-hub] inicio',e?.message||e);return res.status(500).json({erro:'Não foi possível carregar o dashboard.'});}",
    "}",
    ""
  ].join('\n');
  c=c.slice(0,a)+fn+c.slice(b);
}

c=c.replace(/module\.exports=\{([^}]*)\}/,(m,inside)=>{
  if(inside.includes('salvarEquipe'))return m;
  return 'module.exports={'+inside.trim().replace(/,$/,'')+',salvarEquipe}';
});
write('src/controllers/clienteHub.controller.js',c);

let routes=read('src/routes/clienteHub.routes.js');
if(!routes.includes("'/equipe'")){
  const a="r.get('/inicio',c.inicioCliente);";
  if(!routes.includes(a))throw new Error('Rota inicio não encontrada');
  routes=routes.replace(a,a+"\nr.put('/equipe',c.salvarEquipe);");
}
write('src/routes/clienteHub.routes.js',routes);

let booking=read('src/services/bookingPublic.service.js');
booking=booking.replace("select('id,nome,descricao,preco,duracao_min,intervalo_pos_min,ativo')","select('id,nome,descricao,preco,duracao_min,intervalo_pos_min,imagem_url,ativo')");
booking=booking.replace("duracao_min:Number(s.duracao_min||0)}))","duracao_min:Number(s.duracao_min||0),imagem_url:s.imagem_url||null}))");
write('src/services/bookingPublic.service.js',booking);

let central=read('public/cliente-central.html');
central=central.replace('<title>SaintsAI Cliente</title>','<title>SaintsAI Dashboard</title>');
central=central.replace('<div class="brand">SaintsAI Cliente</div>','<div class="brand">SaintsAI Dashboard</div>');
if(!central.includes('cliente-dashboard-polish-v3.css'))central=central.replace('</head>','<link rel="stylesheet" href="css/cliente-dashboard-polish-v3.css"></head>');
if(!central.includes('cliente-dashboard-polish-v3.js'))central=central.replace('</body>','<script src="js/cliente-dashboard-polish-v3.js"></script></body>');
write('public/cliente-central.html',central);

let config=read('public/cliente-configuracao.html');
if(!config.includes('cliente-dashboard-polish-v3.css'))config=config.replace('</head>','<link rel="stylesheet" href="css/cliente-dashboard-polish-v3.css"></head>');
if(!config.includes('cliente-config-polish-v3.js'))config=config.replace('</body>','<script src="js/cliente-config-polish-v3.js"></script></body>');
write('public/cliente-configuracao.html',config);

for(const p of ['src/controllers/servicoImagem.controller.js','src/routes/servicoImagem.routes.js','src/controllers/clienteHub.controller.js','src/routes/clienteHub.routes.js','src/services/bookingPublic.service.js','src/app.js','public/js/cliente-dashboard-polish-v3.js','public/js/cliente-config-polish-v3.js'])cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
console.log('SaintsAI Dashboard polish v3 aplicado.');