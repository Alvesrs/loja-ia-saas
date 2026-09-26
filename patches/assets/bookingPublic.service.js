const crypto=require('node:crypto');
const supabase=require('../config/supabase');
const pagBankPix=require('./pagBankPix.service');

function erro(codigo,mensagem,status=400){const e=new Error(mensagem);e.codigo=codigo;e.status=status;return e;}
function hashToken(token){return crypto.createHash('sha256').update(String(token||'')).digest('hex');}
function baseUrl(){
  let v=String(process.env.SAINTSAI_PUBLIC_BASE_URL||'').trim().replace(/\/+$/,'');
  if(!v&&process.env.RAILWAY_PUBLIC_DOMAIN)v='https://'+String(process.env.RAILWAY_PUBLIC_DOMAIN).replace(/^https?:\/\//,'').replace(/\/+$/,'');
  if(!v)throw erro('base_url_ausente','O link público de agendamento ainda não está configurado.',503);
  return v;
}
function hojeSP(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function addDias(data,n){const d=new Date(String(data)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function isoLocal(data,hora){return String(data)+'T'+String(hora)+':00-03:00';}
function hmMin(hm){const m=String(hm||'').match(/^(\d{2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null;}
function horaValida(v){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v||''));}
function dataValida(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''));}
function dataDentroHorizonte(v){return dataValida(v)&&v>=hojeSP()&&v<=addDias(hojeSP(),31);}
function dinheiro(v){return Number(v||0).toFixed(2);}
function duracao(servico){return Number(servico.duracao_min||0)+Number(servico.intervalo_pos_min||0);}

async function obterLink(token,{permitirUsado=false}={}){
  const t=String(token||'').trim();
  if(!/^[A-Za-z0-9_-]{20,120}$/.test(t))throw erro('link_invalido','Este link de agendamento é inválido.',404);
  const {data,error}=await supabase.from('saintsai_agenda_links').select('*').eq('token_hash',hashToken(t)).maybeSingle();
  if(error)throw error;
  if(!data)throw erro('link_invalido','Este link de agendamento não existe.',404);
  if(new Date(data.expira_em).getTime()<=Date.now())throw erro('link_expirado','Este link expirou. Peça um novo link pelo WhatsApp.',410);
  if(data.usado_em&&!permitirUsado)throw erro('link_usado','Este link já foi usado para um agendamento.',409);
  supabase.from('saintsai_agenda_links').update({ultimo_acesso_em:new Date().toISOString()}).eq('id',data.id).then(()=>{}).catch(()=>{});
  return data;
}

async function criarLink({lojaId,contato,clienteNome=null}){
  const token=crypto.randomBytes(24).toString('base64url');
  const expira=new Date(Date.now()+2*60*60*1000).toISOString();
  const {error}=await supabase.from('saintsai_agenda_links').insert({
    loja_id:lojaId,token_hash:hashToken(token),contato:String(contato||'').slice(0,128),
    cliente_nome:clienteNome?String(clienteNome).slice(0,100):null,expira_em:expira
  });
  if(error)throw error;
  return baseUrl()+'/agendar/'+encodeURIComponent(token);
}

function opcoesPagamento(cfg){
  const c=cfg||{};
  const online=Boolean(c.conectado&&c.provedor==='pagbank'&&c.aceita_pix_online);
  const op=[];
  if(c.aceita_dinheiro!==false)op.push({id:'dinheiro',nome:'Dinheiro no atendimento'});
  if(c.aceita_pix_presencial!==false)op.push({id:'pix_presencial',nome:'Pix no atendimento'});
  if(c.aceita_cartao_presencial!==false)op.push({id:'cartao_presencial',nome:'Cartão no atendimento'});
  if(online)op.unshift({id:'pix_online',nome:'Pix agora'});
  if(c.exige_pagamento_antecipado===true)return online?[{id:'pix_online',nome:'Pix agora'}]:[];
  return op;
}

async function carregarBase(link){
  const [{data:loja,error:e1},{data:servicos,error:e2},{data:cfg,error:e3},{data:pag,error:e4}]=await Promise.all([
    supabase.from('lojas').select('id,nome,ativa').eq('id',link.loja_id).maybeSingle(),
    supabase.from('saintsai_servicos').select('id,nome,descricao,preco,duracao_min,intervalo_pos_min,ativo').eq('loja_id',link.loja_id).eq('ativo',true).order('nome'),
    supabase.from('saintsai_agenda_config').select('*').eq('loja_id',link.loja_id).maybeSingle(),
    supabase.from('saintsai_pagamento_config').select('provedor,conectado,aceita_pix_online,aceita_pix_presencial,aceita_dinheiro,aceita_cartao_presencial,exige_pagamento_antecipado').eq('loja_id',link.loja_id).maybeSingle()
  ]);
  if(e1||e2||e3||e4)throw (e1||e2||e3||e4);
  if(!loja||loja.ativa===false)throw erro('loja_indisponivel','Esta empresa não está disponível para agendamento agora.',404);
  if(!cfg||!cfg.horarios||typeof cfg.horarios!=='object')throw erro('agenda_nao_configurada','A agenda desta empresa ainda não está configurada.',409);
  return {loja,servicos:servicos||[],cfg,pag:pag||null};
}

async function resumo(token){
  const link=await obterLink(token);
  const b=await carregarBase(link);
  const opcoes=opcoesPagamento(b.pag);
  return {
    loja:{nome:b.loja.nome},
    servicos:b.servicos.map(s=>({id:s.id,nome:s.nome,descricao:s.descricao||'',preco:Number(s.preco||0),duracao_min:Number(s.duracao_min||0)})),
    pagamentos:{
      opcoes,
      exige_pagamento_antecipado:Boolean(b.pag?.exige_pagamento_antecipado),
      pix_online_disponivel:opcoes.some(x=>x.id==='pix_online'),
      bloqueado:Boolean(b.pag?.exige_pagamento_antecipado)&&!opcoes.some(x=>x.id==='pix_online')
    },
    cliente_nome:link.cliente_nome||'',
    expira_em:link.expira_em
  };
}

function slotsDia(servico,data,cfg,ocupados){
  const dia=new Date(data+'T12:00:00Z').getUTCDay();
  const regra=cfg.horarios?.[String(dia)];
  if(!regra||regra.aberto!==true||!horaValida(regra.inicio)||!horaValida(regra.fim))return [];
  const ini=hmMin(regra.inicio),fim=hmMin(regra.fim),passo=Math.max(5,Number(cfg.intervalo_grade_min||30));
  const dur=duracao(servico);if(dur<=0)return [];
  const out=[];
  for(let m=ini;m+dur<=fim;m+=passo){
    const hora=String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
    const a=new Date(isoLocal(data,hora)),b=new Date(a.getTime()+dur*60000);
    if(a.getTime()<Date.now())continue;
    if(!(ocupados||[]).some(x=>new Date(x.inicio)<b&&new Date(x.fim)>a))out.push(hora);
  }
  return out;
}

async function disponibilidade(token,servicoId){
  const link=await obterLink(token);
  const b=await carregarBase(link);
  const servico=b.servicos.find(s=>s.id===servicoId);
  if(!servico)throw erro('servico_indisponivel','Este item ou serviço não está mais disponível.',404);
  const inicio=hojeSP(),fim=addDias(inicio,32);
  const {data:ags,error}=await supabase.from('saintsai_agendamentos').select('inicio,fim,status')
    .eq('loja_id',link.loja_id).neq('status','cancelado')
    .gte('inicio',new Date(isoLocal(inicio,'00:00')).toISOString())
    .lt('inicio',new Date(isoLocal(fim,'00:00')).toISOString());
  if(error)throw error;
  const dias=[];
  for(let i=0;i<=31;i++){
    const data=addDias(inicio,i),slots=slotsDia(servico,data,b.cfg,ags||[]);
    if(slots.length)dias.push({data,slots:slots.slice(0,30)});
    if(dias.length>=14)break;
  }
  return {servico:{id:servico.id,nome:servico.nome,preco:Number(servico.preco||0),duracao_min:Number(servico.duracao_min||0)},dias};
}

async function confirmar(token,body){
  const link=await obterLink(token);
  const b=await carregarBase(link);
  const servico=b.servicos.find(s=>s.id===String(body?.servico_id||''));
  if(!servico)throw erro('servico_indisponivel','Este item ou serviço não está mais disponível.',404);
  const data=String(body?.data||''),hora=String(body?.hora||''),nome=String(body?.nome||'').trim();
  if(!dataDentroHorizonte(data)||!horaValida(hora))throw erro('horario_invalido','Escolha novamente a data e o horário.',400);
  if(nome.length<2||nome.length>100)throw erro('nome_invalido','Informe o nome para o agendamento.',400);

  const revisado=Number(body?.preco_revisado);
  const precoAtual=Number(servico.preco||0);
  if(!Number.isFinite(revisado)||Math.abs(revisado-precoAtual)>0.004){
    const e=erro('preco_alterado','O preço mudou durante o agendamento. Revise o valor atualizado antes de confirmar.',409);
    e.preco_atual=precoAtual;throw e;
  }

  const metodo=String(body?.pagamento_metodo||'');
  const opcoes=opcoesPagamento(b.pag);
  if(!opcoes.some(x=>x.id===metodo)){
    if(Boolean(b.pag?.exige_pagamento_antecipado)&&!opcoes.some(x=>x.id==='pix_online'))
      throw erro('pagamento_online_indisponivel','A empresa exige pagamento antecipado, mas o Pix online ainda não está conectado.',409);
    throw erro('pagamento_invalido','Escolha uma forma de pagamento disponível.',400);
  }

  const disp=await disponibilidade(token,servico.id);
  const dia=disp.dias.find(x=>x.data===data);
  if(!dia||!dia.slots.includes(hora))throw erro('horario_ocupado','Esse horário acabou de ficar indisponível. Escolha outro.',409);

  const inicio=new Date(isoLocal(data,hora));
  const fim=new Date(inicio.getTime()+duracao(servico)*60000);
  const {data:dup,error:ed}=await supabase.from('saintsai_agendamentos').select('id')
    .eq('loja_id',link.loja_id).eq('cliente_whatsapp',link.contato).eq('inicio',inicio.toISOString())
    .neq('status','cancelado').limit(1);
  if(ed)throw ed;
  if((dup||[]).length)throw erro('agendamento_duplicado','Este cliente já tem um agendamento nesse horário.',409);

  const pix=metodo==='pix_online';
  const {data:ag,error}=await supabase.from('saintsai_agendamentos').insert({
    loja_id:link.loja_id,servico_id:servico.id,cliente_nome:nome,cliente_whatsapp:link.contato,
    inicio:inicio.toISOString(),fim:fim.toISOString(),valor:precoAtual,
    status:pix?'pendente':'confirmado',
    pagamento_metodo:metodo,pagamento_status:pix?'aguardando':'presencial',
    observacoes:'Agendamento criado pelo link interativo do WhatsApp.'
  }).select('*').single();
  if(error){
    if(error.code==='23P01')throw erro('horario_ocupado','Esse horário acabou de ser ocupado. Escolha outro.',409);
    throw error;
  }

  let pixDados=null;
  if(pix){
    try{pixDados=await pagBankPix.criarPixParaAgendamento({...ag,loja_id:link.loja_id,valor:precoAtual},servico);}
    catch(e){
      await supabase.from('saintsai_agendamentos').update({status:'cancelado',pagamento_status:'cancelado',atualizado_em:new Date().toISOString()}).eq('id',ag.id).eq('loja_id',link.loja_id);
      throw erro('pix_falhou','Não foi possível gerar o Pix agora. O horário não foi confirmado.',503);
    }
  }

  await supabase.from('saintsai_agenda_links').update({usado_em:new Date().toISOString(),cliente_nome:nome}).eq('id',link.id);
  return {
    agendamento_id:ag.id,
    servico:{nome:servico.nome,preco:precoAtual},
    data,hora,
    status:pix?'aguardando_pagamento':'confirmado',
    pagamento_metodo:metodo,
    pix:pixDados
  };
}

async function status(token,agendamentoId){
  const link=await obterLink(token,{permitirUsado:true});
  const {data,error}=await supabase.from('saintsai_agendamentos')
    .select('id,status,pagamento_status,pagamento_expira_em,inicio,valor,servico_id')
    .eq('id',String(agendamentoId||'')).eq('loja_id',link.loja_id).eq('cliente_whatsapp',link.contato).maybeSingle();
  if(error)throw error;if(!data)throw erro('agendamento_invalido','Agendamento não encontrado.',404);
  return {status:data.status,pagamento_status:data.pagamento_status,pagamento_expira_em:data.pagamento_expira_em};
}

module.exports={criarLink,resumo,disponibilidade,confirmar,status};
