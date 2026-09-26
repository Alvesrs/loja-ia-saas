const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

let svc=read('src/services/agendaWhatsapp.service.js');

svc=svc.replace(
"const GATILHO=/\\b(agendar|agendamento|marcar|hor[aá]rio|agenda|reservar|reserva)\\b/i;\nconst SIM=/^(sim|s|pode|confirmo|confirmar|confirma|ok|beleza|fechado|isso)$/i;\nconst NAO=/^(não|nao|n|cancelar|cancela|desistir)$/i;",
"const GATILHO=/\\b(agendar|agendamento|marcar|hor[aá]rio|agenda|reservar|reserva)\\b/i;\nconst GATILHO_CANCELAR=/\\b(cancelar|cancela|desmarcar|desmarca)\\b/i;\nconst GATILHO_REAGENDAR=/\\b(reagendar|reagendo|remarcar|remarca|mudar.*hor[aá]rio|trocar.*hor[aá]rio|alterar.*hor[aá]rio)\\b/i;\nconst SIM=/^(sim|s|pode|confirmo|confirmar|confirma|ok|beleza|fechado|isso)$/i;\nconst NAO=/^(não|nao|n|desistir|deixa|deixa pra la)$/i;"
);

svc=svc.replace(
"async function slots(lojaId,servico,data,cfg){",
"async function slots(lojaId,servico,data,cfg,ignorarId=null){"
);
svc=svc.replace(
"  const ocupados=ags||[];",
"  const ocupados=(ags||[]).filter(x=>!ignorarId||x.id!==ignorarId);"
);
svc=svc.replace(
".select('inicio,fim').eq('loja_id',lojaId)",
".select('id,inicio,fim').eq('loja_id',lojaId)"
);

const marker="async function criar(lojaId,contato,servico,estado){";
if(!svc.includes(marker)) throw new Error('Anchor criar agenda não encontrado');
const helpers=`
async function proximosDoContato(lojaId,contato){
  const {data,error}=await supabase.from('saintsai_agendamentos')
    .select('id,servico_id,cliente_nome,cliente_whatsapp,inicio,fim,status,pagamento_status,saintsai_servicos(nome,preco,duracao_min,intervalo_pos_min)')
    .eq('loja_id',lojaId).eq('cliente_whatsapp',contato).neq('status','cancelado')
    .gte('inicio',new Date().toISOString()).order('inicio',{ascending:true}).limit(8);
  if(error)throw error;return data||[];
}
function resumoAg(a,i){
  const d=new Date(a.inicio);
  const data=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
  const hora=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
  return (i+1)+') '+(a.saintsai_servicos?.nome||'Serviço')+' — '+data+' às '+hora;
}
function escolhaIndice(texto,max){
  const m=String(texto||'').trim().match(/^(?:op[cç][aã]o\\s*)?(\\d{1,2})$/i);
  if(!m)return null;const n=Number(m[1]);return n>=1&&n<=max?n-1:null;
}
async function cancelarAgendamento(lojaId,id){
  const {data,error}=await supabase.from('saintsai_agendamentos').update({status:'cancelado',atualizado_em:new Date().toISOString()})
    .eq('id',id).eq('loja_id',lojaId).neq('status','cancelado').select('id,status,pagamento_status').maybeSingle();
  if(error)throw error;return data;
}
async function reagendarAgendamento(lojaId,ag,servico,data,hora,cfg){
  const livres=await slots(lojaId,servico,data,cfg,ag.id);
  if(!livres.includes(hora))return {indisponivel:true,livres};
  const inicio=new Date(isoLocal(data,hora));
  const fim=new Date(inicio.getTime()+(Number(servico.duracao_min)+Number(servico.intervalo_pos_min||0))*60000);
  const {data:upd,error}=await supabase.from('saintsai_agendamentos')
    .update({inicio:inicio.toISOString(),fim:fim.toISOString(),atualizado_em:new Date().toISOString()})
    .eq('id',ag.id).eq('loja_id',lojaId).neq('status','cancelado').select('id,inicio,fim').maybeSingle();
  if(error){if(error.code==='23P01')return {conflito:true};throw error;}
  return {agendamento:upd};
}

`;
svc=svc.replace(marker,helpers+marker);

const oldStart="async function tentarResponder(mensagem){\n  const lojaId=mensagem.lojaId,contato=mensagem.contato,texto=String(mensagem.texto||'').trim();\n  let estado=await estadoAtual(lojaId,contato);\n  const ativo=Boolean(estado&&estado.ativo);\n  if(!ativo&&!GATILHO.test(texto))return null;\n  if(ativo&&NAO.test(normalizar(texto))){\n    await limparEstado(lojaId,contato);\n    return 'Tudo bem. Não confirmei nenhum horário. Se quiser, posso procurar outro horário para você.';\n  }";
const newStart=`async function tentarResponder(mensagem){
  const lojaId=mensagem.lojaId,contato=mensagem.contato,texto=String(mensagem.texto||'').trim();
  let estado=await estadoAtual(lojaId,contato);
  const ativo=Boolean(estado&&estado.ativo);
  const querCancelar=GATILHO_CANCELAR.test(texto);
  const querReagendar=GATILHO_REAGENDAR.test(texto);
  if(!ativo&&!GATILHO.test(texto)&&!querCancelar&&!querReagendar)return null;

  if(ativo&&NAO.test(normalizar(texto))){
    await limparEstado(lojaId,contato);
    return 'Tudo bem. Não fiz nenhuma alteração no seu agendamento.';
  }

  if(!ativo&&(querCancelar||querReagendar)){
    const proximos=await proximosDoContato(lojaId,contato);
    if(!proximos.length)return 'Não encontrei nenhum agendamento futuro vinculado a este WhatsApp.';
    const modo=querCancelar?'cancelar':'reagendar';
    if(proximos.length===1){
      const ag=proximos[0];
      const novo={ativo:true,modo,agendamento_id:ag.id,servico_id:ag.servico_id,servico_nome:ag.saintsai_servicos?.nome||'Serviço',nome:ag.cliente_nome};
      if(modo==='cancelar'){
        novo.aguardando_cancelamento=true;await salvarEstado(lojaId,contato,novo);
        return 'Encontrei '+resumoAg(ag,0).replace(/^1\\) /,'')+'. Posso cancelar esse agendamento?';
      }
      await salvarEstado(lojaId,contato,novo);
      return 'Encontrei '+resumoAg(ag,0).replace(/^1\\) /,'')+'. Para qual dia você quer reagendar?';
    }
    await salvarEstado(lojaId,contato,{ativo:true,modo,selecionando_agendamento:true,opcoes:proximos.map(a=>a.id)});
    return 'Encontrei mais de um agendamento. Qual você quer '+modo+'?\\n'+proximos.map(resumoAg).join('\\n')+'\\nResponda somente com o número.';
  }

  if(ativo&&estado.selecionando_agendamento){
    const idx=escolhaIndice(texto,(estado.opcoes||[]).length);
    if(idx===null)return 'Responda com o número do agendamento que você quer '+estado.modo+'.';
    const proximos=await proximosDoContato(lojaId,contato);
    const id=estado.opcoes[idx];const ag=proximos.find(x=>x.id===id);
    if(!ag){await limparEstado(lojaId,contato);return 'Esse agendamento não está mais disponível para alteração.';}
    estado={ativo:true,modo:estado.modo,agendamento_id:ag.id,servico_id:ag.servico_id,servico_nome:ag.saintsai_servicos?.nome||'Serviço',nome:ag.cliente_nome};
    if(estado.modo==='cancelar'){
      estado.aguardando_cancelamento=true;await salvarEstado(lojaId,contato,estado);
      return 'Posso cancelar '+resumoAg(ag,0).replace(/^1\\) /,'')+'?';
    }
    await salvarEstado(lojaId,contato,estado);
    return 'Para qual dia você quer reagendar '+(ag.saintsai_servicos?.nome||'esse serviço')+'?';
  }

  if(ativo&&estado.modo==='cancelar'&&estado.aguardando_cancelamento&&SIM.test(normalizar(texto))){
    const cancelado=await cancelarAgendamento(lojaId,estado.agendamento_id);
    await limparEstado(lojaId,contato);
    if(!cancelado)return 'Esse agendamento já havia sido cancelado ou não está mais disponível.';
    return cancelado.pagamento_status==='pago'
      ? 'Agendamento cancelado. Como o pagamento já consta como pago, o estorno precisa seguir a política da empresa e não foi feito automaticamente.'
      : 'Agendamento cancelado com sucesso.';
  }`;
if(!svc.includes(oldStart)) throw new Error('Início do fluxo WhatsApp não encontrado');
svc=svc.replace(oldStart,newStart);

const extractionAnchor="  const x=await extrair(texto,servicos,estado);";
if(!svc.includes(extractionAnchor)) throw new Error('Anchor de extração não encontrado');
svc=svc.replace(extractionAnchor,`  const x=await extrair(texto,servicos,estado);

  if(estado.modo==='reagendar'){
    const {data:ag,error:ea}=await supabase.from('saintsai_agendamentos')
      .select('id,servico_id,cliente_nome,inicio,fim,status,saintsai_servicos(id,nome,preco,duracao_min,intervalo_pos_min)')
      .eq('id',estado.agendamento_id).eq('loja_id',lojaId).neq('status','cancelado').maybeSingle();
    if(ea)throw ea;if(!ag){await limparEstado(lojaId,contato);return 'Esse agendamento não está mais disponível para reagendamento.';}
    const svAg=ag.saintsai_servicos;
    if(!svAg){await limparEstado(lojaId,contato);return 'O serviço desse agendamento não está mais disponível.';}
    if(dataValida(x.data))estado.data=x.data;
    if(horaValida(x.hora))estado.hora=x.hora;
    if(!estado.data){await salvarEstado(lojaId,contato,estado);return 'Para qual dia você quer reagendar '+svAg.nome+'?';}
    const livres=await slots(lojaId,svAg,estado.data,cfg,ag.id);
    if(!livres.length){estado.hora=null;await salvarEstado(lojaId,contato,estado);return 'Não encontrei horários livres em '+brData(estado.data)+'. Qual outro dia você prefere?';}
    if(!estado.hora){await salvarEstado(lojaId,contato,estado);return 'Em '+brData(estado.data)+' tenho: '+livres.slice(0,6).join(', ')+'. Qual horário você prefere?';}
    if(!livres.includes(estado.hora)){estado.hora=null;await salvarEstado(lojaId,contato,estado);return 'Esse horário não está disponível. Tenho: '+livres.slice(0,6).join(', ')+'. Qual prefere?';}
    if(!estado.aguardando_confirmacao_reagendamento){
      estado.aguardando_confirmacao_reagendamento=true;await salvarEstado(lojaId,contato,estado);
      return 'Posso reagendar '+svAg.nome+' para '+brData(estado.data)+' às '+estado.hora+'?';
    }
    if(SIM.test(normalizar(texto))){
      const r=await reagendarAgendamento(lojaId,ag,svAg,estado.data,estado.hora,cfg);
      if(r.conflito||r.indisponivel){estado.aguardando_confirmacao_reagendamento=false;estado.hora=null;await salvarEstado(lojaId,contato,estado);return 'Esse horário acabou de ficar indisponível. Escolha outro horário, por favor.';}
      await limparEstado(lojaId,contato);
      return 'Pronto. Seu agendamento foi reagendado para '+brData(estado.data)+' às '+estado.hora+'.';
    }
    return 'Responda sim para confirmar o novo horário ou não para desistir.';
  }`);

write('src/services/agendaWhatsapp.service.js',svc);

let c=read('src/controllers/clienteHub.controller.js');
const oldUpdate="async function atualizarAgendamento(req,res){\n  try{const loja=await exigirLoja(req,res);if(!loja)return;const dados={atualizado_em:new Date().toISOString()};if(req.body?.status!==undefined)dados.status=String(req.body.status);if(req.body?.pagamento_status!==undefined)dados.pagamento_status=String(req.body.pagamento_status);const {data,error}=await supabase.from('saintsai_agendamentos').update(dados).eq('id',req.params.agendamentoId).eq('loja_id',loja.id).select('*').maybeSingle();if(error)throw error;if(!data)return res.status(404).json({erro:'Agendamento não encontrado.'});return res.json(data);}\n  catch(e){return res.status(500).json({erro:'Não foi possível atualizar o agendamento.'});}\n}";
const newUpdate=`async function atualizarAgendamento(req,res){
  try{
    const loja=await exigirLoja(req,res);if(!loja)return;
    const {data:atual,error:eb}=await supabase.from('saintsai_agendamentos').select('*,saintsai_servicos(id,duracao_min,intervalo_pos_min)').eq('id',req.params.agendamentoId).eq('loja_id',loja.id).maybeSingle();
    if(eb)throw eb;if(!atual)return res.status(404).json({erro:'Agendamento não encontrado.'});
    const dados={atualizado_em:new Date().toISOString()};
    if(req.body?.status!==undefined){
      const s=String(req.body.status);if(!['pendente','confirmado','em_atendimento','concluido','cancelado'].includes(s))return res.status(400).json({erro:'Status inválido.'});dados.status=s;
    }
    if(req.body?.pagamento_status!==undefined){
      const p=String(req.body.pagamento_status);if(!['pendente','aguardando','pago','presencial','cancelado','estornado'].includes(p))return res.status(400).json({erro:'Status de pagamento inválido.'});dados.pagamento_status=p;
    }
    if(req.body?.inicio!==undefined){
      if(atual.status==='cancelado')return res.status(409).json({erro:'Agendamento cancelado não pode ser reagendado.'});
      const inicio=new Date(req.body.inicio);if(Number.isNaN(inicio.getTime())||inicio.getTime()<Date.now())return res.status(400).json({erro:'Novo horário inválido.'});
      const sv=atual.saintsai_servicos;if(!sv)return res.status(409).json({erro:'Serviço do agendamento não está disponível.'});
      const fim=new Date(inicio.getTime()+(Number(sv.duracao_min)+Number(sv.intervalo_pos_min||0))*60000);
      const {data:conflitos,error:ec}=await supabase.from('saintsai_agendamentos').select('id').eq('loja_id',loja.id).neq('id',atual.id).neq('status','cancelado').lt('inicio',fim.toISOString()).gt('fim',inicio.toISOString()).limit(1);
      if(ec)throw ec;if((conflitos||[]).length)return res.status(409).json({erro:'Esse horário já está ocupado.'});
      dados.inicio=inicio.toISOString();dados.fim=fim.toISOString();
    }
    const {data,error}=await supabase.from('saintsai_agendamentos').update(dados).eq('id',atual.id).eq('loja_id',loja.id).select('*,saintsai_servicos(nome)').maybeSingle();
    if(error){if(error.code==='23P01')return res.status(409).json({erro:'Esse horário já está ocupado.'});throw error;}
    return res.json(data);
  }catch(e){console.error('[cliente-hub] atualizar agendamento',e?.message||e);return res.status(500).json({erro:'Não foi possível atualizar o agendamento.'});}
}`;
if(!c.includes(oldUpdate)) throw new Error('Atualizador de agendamento não encontrado');
c=c.replace(oldUpdate,newUpdate);
write('src/controllers/clienteHub.controller.js',c);

let h=read('public/cliente-central.html');
if(!h.includes('agenda-gerenciar')){
  const anchor='<section id="agenda" class="section"><div class="panel"><h2>Novo agendamento</h2>';
  if(!h.includes(anchor)) throw new Error('Seção Agenda não encontrada');
  h=h.replace(anchor,'<section id="agenda" class="section"><div class="panel" id="agenda-gerenciar"><h2>Próximos agendamentos</h2><p class="muted">Reagende ou cancele sem perder o histórico.</p><div id="lista-agenda-gerenciar"></div></div><div class="panel" style="margin-top:12px"><h2>Novo agendamento</h2>');
  h=h.replace(
"function renderAgenda(){const arr=dados.agenda||[];$('lista-agenda').innerHTML=arr.length?arr.slice(0,8).map(a=>'<div class=\"item\"><strong>'+new Date(a.inicio).toLocaleString('pt-BR')+' · '+a.cliente_nome+'</strong><div class=\"muted\">'+(a.saintsai_servicos?.nome||'Serviço')+' · '+dinheiro(a.valor)+' · <span class=\"badge\">'+a.pagamento_status+'</span></div></div>').join(''):'<div class=\"muted\">Nenhum agendamento próximo.</div>';}",
"function renderAgenda(){const arr=(dados.agenda||[]).filter(a=>a.status!=='cancelado');const card=a=>'<div class=\"item\"><strong>'+new Date(a.inicio).toLocaleString('pt-BR')+' · '+a.cliente_nome+'</strong><div class=\"muted\">'+(a.saintsai_servicos?.nome||'Serviço')+' · '+dinheiro(a.valor)+' · <span class=\"badge\">'+a.status+'</span></div></div>';$('lista-agenda').innerHTML=arr.length?arr.slice(0,8).map(card).join(''):'<div class=\"muted\">Nenhum agendamento próximo.</div>';const g=$('lista-agenda-gerenciar');if(g)g.innerHTML=arr.length?arr.map(a=>'<div class=\"item\" data-ag=\"'+a.id+'\"><strong>'+new Date(a.inicio).toLocaleString('pt-BR')+' · '+a.cliente_nome+'</strong><div class=\"muted\">'+(a.saintsai_servicos?.nome||'Serviço')+' · '+dinheiro(a.valor)+'</div><div class=\"row\" style=\"margin-top:9px\"><input class=\"ag-edit-time\" type=\"datetime-local\" value=\"'+new Date(new Date(a.inicio).getTime()-new Date(a.inicio).getTimezoneOffset()*60000).toISOString().slice(0,16)+'\" style=\"background:#09070f;border:1px solid #3b2e53;color:#fff;border-radius:10px;padding:9px\"><button class=\"btn2 ag-reagendar\" data-id=\"'+a.id+'\">Reagendar</button><button class=\"btn2 ag-cancelar\" data-id=\"'+a.id+'\">Cancelar</button></div></div>').join(''):'<div class=\"muted\">Nenhum agendamento para gerenciar.</div>';}"
  );
  h=h.replace(
"$('sv-add').onclick=async()=>{",
"document.addEventListener('click',async e=>{const b=e.target.closest('.ag-cancelar,.ag-reagendar');if(!b||!loja)return;const id=b.dataset.id;try{b.disabled=true;if(b.classList.contains('ag-cancelar')){if(!confirm('Cancelar este agendamento?'))return;await apiFetch('/lojas/'+loja.id+'/cliente-hub/agendamentos/'+id,{method:'PUT',body:JSON.stringify({status:'cancelado'})});}else{const row=b.closest('[data-ag]');const v=row.querySelector('.ag-edit-time').value;if(!v)throw new Error('Escolha o novo horário.');await apiFetch('/lojas/'+loja.id+'/cliente-hub/agendamentos/'+id,{method:'PUT',body:JSON.stringify({inicio:v})});}await carregar();}catch(err){alert(err.message||'Não foi possível alterar o agendamento.');}finally{b.disabled=false;}});\n$('sv-add').onclick=async()=>{"
  );
}
write('public/cliente-central.html',h);

cp.execFileSync(process.execPath,['--check','src/services/agendaWhatsapp.service.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','src/controllers/clienteHub.controller.js'],{stdio:'inherit'});
console.log('Cancelamento e reagendamento v2 aplicados.');
