const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const os=require('node:os');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

fs.copyFileSync('patches/assets/profissionais.service.js','src/services/profissionais.service.js');
fs.copyFileSync('patches/assets/profissionaisCliente.controller.js','src/controllers/profissionaisCliente.controller.js');
fs.copyFileSync('patches/assets/profissionaisCliente.routes.js','src/routes/profissionaisCliente.routes.js');
fs.copyFileSync('patches/assets/bookingPublic-profissionais.service.js','src/services/bookingPublic.service.js');
fs.copyFileSync('patches/assets/agendar-profissionais.html','public/agendar.html');
fs.copyFileSync('patches/assets/cliente-profissionais-v1.js','public/js/cliente-profissionais-v1.js');
fs.copyFileSync('patches/assets/cliente-profissionais-v1.css','public/css/cliente-profissionais-v1.css');

/* Monta CRUD da equipe dentro do cliente-hub */
let routes=read('src/routes/clienteHub.routes.js');
if(!routes.includes("const profissionaisRouter=require('./profissionaisCliente.routes');")){
  routes=routes.replace("const express=require('express');","const express=require('express');\nconst profissionaisRouter=require('./profissionaisCliente.routes');");
}
if(!routes.includes("r.use('/profissionais',profissionaisRouter);")){
  const p=routes.lastIndexOf('module.exports=');
  if(p<0)throw new Error('Export das rotas clienteHub não encontrado');
  routes=routes.slice(0,p)+"r.use('/profissionais',profissionaisRouter);\n"+routes.slice(p);
}
write('src/routes/clienteHub.routes.js',routes);

/* Página de configuração: equipe real */
let cfg=read('public/cliente-configuracao.html');
if(!cfg.includes('cliente-profissionais-v1.css'))cfg=cfg.replace('</head>','<link rel="stylesheet" href="css/cliente-profissionais-v1.css"></head>');
if(!cfg.includes('cliente-profissionais-v1.js'))cfg=cfg.replace('</body>','<script src="js/cliente-profissionais-v1.js"></script></body>');
write('public/cliente-configuracao.html',cfg);

/* API pública recebe profissional opcional */
let bc=read('src/controllers/bookingPublic.controller.js');
bc=bc.replace(
  "booking.disponibilidade(req.params.token,String(req.query.servico_id||''))",
  "booking.disponibilidade(req.params.token,String(req.query.servico_id||''),req.query.profissional_id?String(req.query.profissional_id):null)"
);
write('src/controllers/bookingPublic.controller.js',bc);

/* WhatsApp textual usa a mesma capacidade por profissional */
let agenda=read('src/services/agendaWhatsapp.service.js');
if(!agenda.includes("const profissionaisSvc=require('./profissionais.service');")){
  const a="const pagBankPix=require('./pagBankPix.service');";
  if(agenda.includes(a))agenda=agenda.replace(a,a+"\nconst profissionaisSvc=require('./profissionais.service');");
  else{
    const b="const llm=require('./llm.service');";
    if(!agenda.includes(b))throw new Error('Import LLM da agenda não encontrado');
    agenda=agenda.replace(b,b+"\nconst profissionaisSvc=require('./profissionais.service');");
  }
}

{
  const a=agenda.indexOf('async function slots(');
  if(a<0)throw new Error('Função slots da agenda não encontrada');
  const b=agenda.indexOf('\nasync function ',a+20);
  if(b<0)throw new Error('Fim da função slots não encontrado');
  const fn=[
    "async function slots(lojaId,servico,data,cfg,ignorarId=null){",
    "  const lista=await profissionaisSvc.slotsDia(lojaId,servico,data,cfg,{ignorarId});",
    "  return lista.map(x=>x.hora);",
    "}"
  ].join('\n');
  agenda=agenda.slice(0,a)+fn+agenda.slice(b);
}

{
  const a=agenda.indexOf('async function criar(lojaId,contato,servico,estado){');
  const b=agenda.indexOf('\nasync function tentarResponder(',a);
  if(a<0||b<0)throw new Error('Função criar da agenda não encontrada');
  const fn=[
    "async function criar(lojaId,contato,servico,estado){",
    "  const cfgAgenda=await config(lojaId);",
    "  const escolhido=await profissionaisSvc.escolherDisponivel(lojaId,servico,estado.data,estado.hora,cfgAgenda,{});",
    "  if(!escolhido)return {conflito:true};",
    "  const inicio=new Date(isoLocal(estado.data,estado.hora));",
    "  const fim=new Date(inicio.getTime()+(Number(servico.duracao_min)+Number(servico.intervalo_pos_min||0))*60000);",
    "  const {data:pag}=await supabase.from('saintsai_pagamento_config').select('*').eq('loja_id',lojaId).maybeSingle();",
    "  let metodo='presencial',pagStatus='presencial',status='confirmado';",
    "  if(estado.pagamento_metodo==='pix_online'&&pag?.conectado&&pag?.aceita_pix_online){metodo='pix_online';pagStatus='aguardando';status='pendente';}",
    "  const {data,error}=await supabase.from('saintsai_agendamentos').insert({",
    "    loja_id:lojaId,servico_id:servico.id,profissional_id:escolhido.id||null,cliente_nome:estado.nome,cliente_whatsapp:contato,",
    "    inicio:inicio.toISOString(),fim:fim.toISOString(),valor:Number(servico.preco||0),status,",
    "    pagamento_metodo:metodo,pagamento_status:pagStatus",
    "  }).select('id,inicio,status,pagamento_status,profissional_id').single();",
    "  if(error){if(error.code==='23P01')return {conflito:true};throw error;}",
    "  if(metodo==='pix_online'&&pag?.provedor==='pagbank'){",
    "    try{const pix=await pagBankPix.criarPixParaAgendamento({...data,loja_id:lojaId,valor:Number(servico.preco||0)},servico);return {agendamento:data,pix,profissional:escolhido};}",
    "    catch(e){await supabase.from('saintsai_agendamentos').update({status:'cancelado',pagamento_status:'cancelado',atualizado_em:new Date().toISOString()}).eq('id',data.id).eq('loja_id',lojaId);return {pagamentoErro:true};}",
    "  }",
    "  return {agendamento:data,profissional:escolhido};",
    "}"
  ].join('\n');
  agenda=agenda.slice(0,a)+fn+agenda.slice(b);
}

agenda=agenda.replace(
  "select('id,servico_id,cliente_nome,inicio,fim,status,saintsai_servicos(id,nome,preco,duracao_min,intervalo_pos_min)')",
  "select('id,servico_id,profissional_id,cliente_nome,inicio,fim,status,saintsai_servicos(id,nome,preco,duracao_min,intervalo_pos_min)')"
);

{
  const a=agenda.indexOf('async function reagendarAgendamento(');
  if(a>=0){
    const b=agenda.indexOf('\nasync function ',a+20);
    if(b>0){
      const fn=[
        "async function reagendarAgendamento(lojaId,ag,servico,data,hora,cfg){",
        "  const escolhido=await profissionaisSvc.escolherDisponivel(lojaId,servico,data,hora,cfg,{profissionalId:ag.profissional_id||null,ignorarId:ag.id});",
        "  if(!escolhido)return {indisponivel:true,livres:await slots(lojaId,servico,data,cfg,ag.id)};",
        "  const inicio=new Date(isoLocal(data,hora));",
        "  const fim=new Date(inicio.getTime()+(Number(servico.duracao_min)+Number(servico.intervalo_pos_min||0))*60000);",
        "  const {data:upd,error}=await supabase.from('saintsai_agendamentos')",
        "    .update({inicio:inicio.toISOString(),fim:fim.toISOString(),profissional_id:escolhido.id||null,atualizado_em:new Date().toISOString()})",
        "    .eq('id',ag.id).eq('loja_id',lojaId).neq('status','cancelado').select('id,inicio,fim,profissional_id').maybeSingle();",
        "  if(error){if(error.code==='23P01')return {conflito:true};throw error;}",
        "  return {agendamento:upd};",
        "}"
      ].join('\n');
      agenda=agenda.slice(0,a)+fn+agenda.slice(b);
    }
  }
}
write('src/services/agendaWhatsapp.service.js',agenda);

/* Onboarding passa a acompanhar a equipe real por trigger; texto deixa claro o cadastro nominal */
let hub=read('src/controllers/clienteHub.controller.js');
hub=hub.replace("titulo:'Configure sua equipe',descricao:'Informe quantos profissionais atendem no local.'","titulo:'Cadastre sua equipe',descricao:'Adicione os profissionais, os serviços de cada um e seus horários.'");
write('src/controllers/clienteHub.controller.js',hub);

for(const p of [
  'src/services/profissionais.service.js','src/controllers/profissionaisCliente.controller.js','src/routes/profissionaisCliente.routes.js',
  'src/services/bookingPublic.service.js','src/controllers/bookingPublic.controller.js','src/routes/clienteHub.routes.js',
  'src/services/agendaWhatsapp.service.js','src/controllers/clienteHub.controller.js'
])cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});

for(const file of ['public/agendar.html','public/js/cliente-profissionais-v1.js']){
  if(file.endsWith('.js')){cp.execFileSync(process.execPath,['--check',file],{stdio:'inherit'});continue;}
  const html=read(file),re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;let m,n=0;
  while((m=re.exec(html))){const code=m[1].trim();if(!code)continue;const tmp=path.join(os.tmpdir(),'saintsai-pro-'+(++n)+'.js');fs.writeFileSync(tmp,code);try{cp.execFileSync(process.execPath,['--check',tmp],{stdio:'inherit'});}finally{try{fs.unlinkSync(tmp)}catch(_){}}}
  if(!n)throw new Error('Agendamento público sem JavaScript');
}
console.log('Profissionais reais integrados à agenda, WhatsApp e portal público.');
