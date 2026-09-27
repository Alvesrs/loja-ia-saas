const supabase=require('../config/supabase');
const profissionaisSvc=require('./profissionais.service');

function erro(codigo,mensagem,status=400){const e=new Error(mensagem);e.codigo=codigo;e.status=status;return e;}
function localParts(iso){
  const d=new Date(iso);
  if(Number.isNaN(d.getTime()))return null;
  const data=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  const hora=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
  return {data,hora:hora.replace('24:','00:')};
}
function parseLocal(v){
  const s=String(v||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s))throw erro('inicio_invalido','Informe uma data e hora válidas.');
  const d=new Date(s+':00-03:00');
  if(Number.isNaN(d.getTime()))throw erro('inicio_invalido','Informe uma data e hora válidas.');
  return d;
}
function validarTipo(v){
  const t=String(v||'bloqueio');
  if(!['bloqueio','folga','ferias','feriado'].includes(t))throw erro('tipo_invalido','Tipo de bloqueio inválido.');
  return t;
}

async function resumo(lojaId,{dias=45}={}){
  const agora=new Date(),fim=new Date(agora.getTime()+Math.min(Math.max(Number(dias)||45,1),120)*86400000);
  const [ags,blq,pros,cfg]=await Promise.all([
    supabase.from('saintsai_agendamentos')
      .select('id,cliente_nome,cliente_whatsapp,inicio,fim,valor,status,pagamento_status,profissional_id,servico_id,saintsai_servicos(nome,duracao_min),saintsai_profissionais(nome)')
      .eq('loja_id',lojaId).gte('inicio',new Date(agora.getTime()-86400000).toISOString()).lte('inicio',fim.toISOString())
      .order('inicio',{ascending:true}),
    supabase.from('saintsai_agenda_bloqueios')
      .select('id,profissional_id,tipo,titulo,inicio,fim,ativo,saintsai_profissionais(nome)')
      .eq('loja_id',lojaId).eq('ativo',true).gte('fim',agora.toISOString()).order('inicio',{ascending:true}).limit(200),
    profissionaisSvc.listar(lojaId,{somenteAtivos:true}),
    supabase.from('saintsai_agenda_config').select('*').eq('loja_id',lojaId).maybeSingle()
  ]);
  if(ags.error)throw ags.error;if(blq.error)throw blq.error;if(cfg.error)throw cfg.error;
  const todos=ags.data||[];
  const hoje=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(agora);
  const deHoje=todos.filter(a=>localParts(a.inicio)?.data===hoje&&a.status!=='cancelado');
  return {
    agendamentos:todos,
    bloqueios:blq.data||[],
    profissionais:pros||[],
    agenda_config:cfg.data||null,
    metricas:{
      hoje:deHoje.length,
      confirmados:todos.filter(a=>a.status==='confirmado'&&new Date(a.inicio)>=agora).length,
      pendentes:todos.filter(a=>a.status==='pendente'&&new Date(a.inicio)>=agora).length,
      proximos:todos.filter(a=>!['cancelado','concluido','nao_compareceu'].includes(a.status)&&new Date(a.inicio)>=agora).length
    }
  };
}

async function criarBloqueio(lojaId,body){
  const tipo=validarTipo(body?.tipo);
  const inicio=parseLocal(body?.inicio_local),fim=parseLocal(body?.fim_local);
  if(fim<=inicio)throw erro('periodo_invalido','O fim precisa ser depois do início.');
  if(fim.getTime()-inicio.getTime()>370*86400000)throw erro('periodo_invalido','O bloqueio é longo demais.');
  let profissionalId=body?.profissional_id?String(body.profissional_id):null;
  if(profissionalId){
    const {data:p,error}=await supabase.from('saintsai_profissionais').select('id').eq('id',profissionalId).eq('loja_id',lojaId).eq('ativo',true).maybeSingle();
    if(error)throw error;if(!p)throw erro('profissional_invalido','Profissional não encontrado.');
  }
  const titulo=String(body?.titulo||'').trim().slice(0,120)||null;
  const {data,error}=await supabase.from('saintsai_agenda_bloqueios').insert({
    loja_id:lojaId,profissional_id:profissionalId,tipo,titulo,
    inicio:inicio.toISOString(),fim:fim.toISOString(),ativo:true
  }).select('id,profissional_id,tipo,titulo,inicio,fim,ativo').single();
  if(error)throw error;
  return data;
}

async function removerBloqueio(lojaId,id){
  const {data,error}=await supabase.from('saintsai_agenda_bloqueios')
    .update({ativo:false}).eq('id',id).eq('loja_id',lojaId).eq('ativo',true).select('id').maybeSingle();
  if(error)throw error;if(!data)throw erro('bloqueio_nao_encontrado','Bloqueio não encontrado.',404);
  return true;
}

async function alterarAgendamento(lojaId,id,body){
  const {data:ag,error}=await supabase.from('saintsai_agendamentos')
    .select('id,inicio,fim,status,pagamento_status,profissional_id,servico_id,saintsai_servicos(id,duracao_min,intervalo_pos_min)')
    .eq('id',id).eq('loja_id',lojaId).maybeSingle();
  if(error)throw error;if(!ag)throw erro('agendamento_nao_encontrado','Agendamento não encontrado.',404);

  const patch={atualizado_em:new Date().toISOString()};
  if(body?.status!==undefined){
    const st=String(body.status);
    if(!['pendente','confirmado','em_atendimento','concluido','cancelado','nao_compareceu'].includes(st))throw erro('status_invalido','Status inválido.');
    if(st==='nao_compareceu'&&new Date(ag.inicio).getTime()>Date.now()+60*60*1000)throw erro('no_show_antecipado','Só marque no-show próximo ou depois do horário.');
    patch.status=st;
    if(st==='nao_compareceu')patch.nao_compareceu_em=new Date().toISOString();
  }

  if(body?.inicio_local!==undefined||body?.profissional_id!==undefined){
    if(ag.status==='cancelado')throw erro('cancelado','Agendamento cancelado não pode ser reagendado.',409);
    const inicio=body?.inicio_local!==undefined?parseLocal(body.inicio_local):new Date(ag.inicio);
    if(inicio.getTime()<Date.now()-5*60*1000)throw erro('inicio_invalido','Escolha um horário futuro.');
    const {data:cfg,error:ec}=await supabase.from('saintsai_agenda_config').select('*').eq('loja_id',lojaId).maybeSingle();
    if(ec)throw ec;if(!cfg)throw erro('agenda_nao_configurada','Agenda ainda não configurada.',409);
    const sv=ag.saintsai_servicos;
    if(!sv)throw erro('servico_indisponivel','Serviço indisponível.',409);
    const parts=localParts(inicio.toISOString());
    const pedidoPid=body?.profissional_id!==undefined?(body.profissional_id?String(body.profissional_id):null):(ag.profissional_id||null);
    const escolhido=await profissionaisSvc.escolherDisponivel(lojaId,{id:ag.servico_id,duracao_min:sv.duracao_min,intervalo_pos_min:sv.intervalo_pos_min},parts.data,parts.hora,cfg,{profissionalId:pedidoPid,ignorarId:ag.id});
    if(!escolhido)throw erro('horario_ocupado','Esse horário ou profissional não está disponível.',409);
    const total=Number(sv.duracao_min||0)+Number(sv.intervalo_pos_min||0);
    patch.inicio=inicio.toISOString();
    patch.fim=new Date(inicio.getTime()+total*60000).toISOString();
    patch.profissional_id=escolhido.id||null;
  }

  const {data:upd,error:eu}=await supabase.from('saintsai_agendamentos')
    .update(patch).eq('id',id).eq('loja_id',lojaId)
    .select('id,cliente_nome,inicio,fim,status,pagamento_status,profissional_id,saintsai_profissionais(nome),saintsai_servicos(nome)')
    .maybeSingle();
  if(eu){if(eu.code==='23P01')throw erro('horario_ocupado','Esse horário acabou de ser ocupado.',409);throw eu;}
  return upd;
}

module.exports={resumo,criarBloqueio,removerBloqueio,alterarAgendamento};
