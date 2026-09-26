const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

write('src/services/agendaWhatsapp.service.js', `
const supabase=require('../config/supabase');
const llm=require('./llm.service');

const GATILHO=/\\b(agendar|agendamento|marcar|hor[aá]rio|agenda|reservar|reserva)\\b/i;
const SIM=/^(sim|s|pode|confirmo|confirmar|confirma|ok|beleza|fechado|isso)$/i;
const NAO=/^(não|nao|n|cancelar|cancela|desistir)$/i;

function normalizar(v){return String(v||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim();}
function hojeSP(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function hmMin(hm){const m=String(hm||'').match(/^(\\d{2}):(\\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null;}
function isoLocal(data,hora){return data+'T'+hora+':00-03:00';}
function dataValida(s){return /^\\d{4}-\\d{2}-\\d{2}$/.test(String(s||''))&&!Number.isNaN(new Date(String(s)+'T12:00:00Z').getTime());}
function horaValida(s){return /^([01]\\d|2[0-3]):[0-5]\\d$/.test(String(s||''));}
function brData(s){if(!dataValida(s))return s;const [a,m,d]=s.split('-');return d+'/'+m+'/'+a;}

async function estadoAtual(lojaId,contato){
  const {data}=await supabase.from('saintsai_agenda_conversas').select('estado,expira_em').eq('loja_id',lojaId).eq('contato',contato).maybeSingle();
  if(!data||new Date(data.expira_em).getTime()<Date.now())return {};
  return data.estado&&typeof data.estado==='object'?data.estado:{};
}
async function salvarEstado(lojaId,contato,estado){
  await supabase.from('saintsai_agenda_conversas').upsert({loja_id:lojaId,contato,estado,atualizado_em:new Date().toISOString(),expira_em:new Date(Date.now()+2*60*60*1000).toISOString()},{onConflict:'loja_id,contato'});
}
async function limparEstado(lojaId,contato){await supabase.from('saintsai_agenda_conversas').delete().eq('loja_id',lojaId).eq('contato',contato);}

async function extrair(texto,servicos,estado){
  if(!llm.estaConfigurado())return {};
  const nomes=servicos.map(s=>s.nome);
  const system=[
    'Extraia somente dados de agendamento da mensagem.',
    'Hoje em America/Sao_Paulo é '+hojeSP()+'.',
    'Serviços válidos: '+JSON.stringify(nomes)+'.',
    'Estado atual: '+JSON.stringify(estado||{})+'.',
    'Retorne SOMENTE JSON válido, sem markdown, com estas chaves opcionais:',
    '{"servico":"nome exato ou null","data":"YYYY-MM-DD ou null","hora":"HH:MM ou null","nome":"nome do cliente ou null","confirmar":true|false|null}.',
    'Converta hoje/amanhã/dias da semana para data absoluta. Não invente serviço, nome, data ou hora.'
  ].join('\\n');
  try{
    let r=String(await llm.gerarResposta({systemPrompt:system,pergunta:String(texto||'')})).trim();
    const fence=String.fromCharCode(96).repeat(3);
    if(r.startsWith(fence))r=r.slice(3).replace(/^json\\s*/i,'');
    if(r.endsWith(fence))r=r.slice(0,-3);
    r=r.trim();
    const o=JSON.parse(r);return o&&typeof o==='object'?o:{};
  }catch(_){return {};}
}

function acharServico(servicos,valor,texto){
  const alvo=normalizar(valor);
  if(alvo){
    const ex=servicos.find(s=>normalizar(s.nome)===alvo);if(ex)return ex;
    const inc=servicos.filter(s=>normalizar(s.nome).includes(alvo)||alvo.includes(normalizar(s.nome)));if(inc.length===1)return inc[0];
  }
  const t=normalizar(texto);
  const hit=servicos.filter(s=>t.includes(normalizar(s.nome)));
  return hit.length===1?hit[0]:null;
}

async function config(lojaId){
  const {data,error}=await supabase.from('saintsai_agenda_config').select('*').eq('loja_id',lojaId).maybeSingle();
  if(error)throw error;return data;
}

async function slots(lojaId,servico,data,cfg){
  if(!cfg||!cfg.horarios||typeof cfg.horarios!=='object')return [];
  const dia=new Date(data+'T12:00:00Z').getUTCDay();
  const regra=cfg.horarios[String(dia)];
  if(!regra||regra.aberto!==true||!horaValida(regra.inicio)||!horaValida(regra.fim))return [];
  const ini=hmMin(regra.inicio),fim=hmMin(regra.fim),passo=Number(cfg.intervalo_grade_min||30);
  const dur=Number(servico.duracao_min||0)+Number(servico.intervalo_pos_min||0);
  const diaIni=new Date(isoLocal(data,'00:00'));
  const diaFim=new Date(diaIni.getTime()+86400000);
  const {data:ags,error}=await supabase.from('saintsai_agendamentos').select('inicio,fim').eq('loja_id',lojaId).neq('status','cancelado').gte('inicio',diaIni.toISOString()).lt('inicio',diaFim.toISOString());
  if(error)throw error;
  const ocupados=ags||[];
  const saida=[];
  for(let m=ini;m+dur<=fim;m+=passo){
    const hh=String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
    const a=new Date(isoLocal(data,hh));const b=new Date(a.getTime()+dur*60000);
    if(a.getTime()<Date.now())continue;
    if(!ocupados.some(x=>new Date(x.inicio)<b&&new Date(x.fim)>a))saida.push(hh);
  }
  return saida;
}

async function criar(lojaId,contato,servico,estado){
  const inicio=new Date(isoLocal(estado.data,estado.hora));
  const fim=new Date(inicio.getTime()+(Number(servico.duracao_min)+Number(servico.intervalo_pos_min||0))*60000);
  const {data:pag}=await supabase.from('saintsai_pagamento_config').select('*').eq('loja_id',lojaId).maybeSingle();
  let metodo='presencial',pagStatus='presencial',status='confirmado';
  if(estado.pagamento_metodo==='pix_online'&&pag?.conectado&&pag?.aceita_pix_online){metodo='pix_online';pagStatus='aguardando';status='pendente';}
  const {data,error}=await supabase.from('saintsai_agendamentos').insert({
    loja_id:lojaId,servico_id:servico.id,cliente_nome:estado.nome,cliente_whatsapp:contato,
    inicio:inicio.toISOString(),fim:fim.toISOString(),valor:Number(servico.preco||0),status,
    pagamento_metodo:metodo,pagamento_status:pagStatus
  }).select('id,inicio,status,pagamento_status').single();
  if(error){if(error.code==='23P01')return {conflito:true};throw error;}
  return {agendamento:data};
}

async function tentarResponder(mensagem){
  const lojaId=mensagem.lojaId,contato=mensagem.contato,texto=String(mensagem.texto||'').trim();
  let estado=await estadoAtual(lojaId,contato);
  const ativo=Boolean(estado&&estado.ativo);
  if(!ativo&&!GATILHO.test(texto))return null;
  if(ativo&&NAO.test(normalizar(texto))){
    await limparEstado(lojaId,contato);
    return 'Tudo bem. Não confirmei nenhum horário. Se quiser, posso procurar outro horário para você.';
  }

  const {data:servicos,error}=await supabase.from('saintsai_servicos').select('id,nome,preco,duracao_min,intervalo_pos_min').eq('loja_id',lojaId).eq('ativo',true).order('nome');
  if(error)throw error;
  if(!(servicos||[]).length){await limparEstado(lojaId,contato);return 'No momento não há serviços cadastrados para agendamento.';}

  const cfg=await config(lojaId);
  if(!cfg||!cfg.horarios||Object.keys(cfg.horarios).length===0){
    await limparEstado(lojaId,contato);
    return 'A agenda online desta empresa ainda não está configurada. Posso continuar ajudando pelo atendimento.';
  }

  if(!ativo)estado={ativo:true};
  if(estado.aguardando_confirmacao&&SIM.test(normalizar(texto))){
    const servico=servicos.find(s=>s.id===estado.servico_id);
    if(!servico){await limparEstado(lojaId,contato);return 'O serviço escolhido não está mais disponível. Qual serviço você deseja agendar?';}
    const livres=await slots(lojaId,servico,estado.data,cfg);
    if(!livres.includes(estado.hora)){
      estado.aguardando_confirmacao=false;estado.hora=null;await salvarEstado(lojaId,contato,estado);
      return livres.length?'Esse horário acabou de ficar indisponível. Tenho '+livres.slice(0,5).join(', ')+'. Qual prefere?':'Esse dia ficou sem horários disponíveis. Qual outro dia você prefere?';
    }
    const r=await criar(lojaId,contato,servico,estado);
    if(r.conflito){estado.aguardando_confirmacao=false;estado.hora=null;await salvarEstado(lojaId,contato,estado);return 'Esse horário acabou de ser ocupado. Me diga outro horário e eu verifico para você.';}
    await limparEstado(lojaId,contato);
    return 'Agendamento confirmado: '+servico.nome+' em '+brData(estado.data)+' às '+estado.hora+'.';
  }

  const x=await extrair(texto,servicos,estado);
  const servico=acharServico(servicos,x.servico,texto)||servicos.find(s=>s.id===estado.servico_id)||null;
  if(servico){estado.servico_id=servico.id;estado.servico_nome=servico.nome;}
  if(dataValida(x.data))estado.data=x.data;
  if(horaValida(x.hora))estado.hora=x.hora;
  if(typeof x.nome==='string'&&x.nome.trim().length>=2&&x.nome.trim().length<=100)estado.nome=x.nome.trim();

  if(!estado.servico_id){
    await salvarEstado(lojaId,contato,estado);
    return 'Claro. Qual serviço você quer agendar? Temos: '+servicos.slice(0,8).map(s=>s.nome).join(', ')+'.';
  }
  const sv=servicos.find(s=>s.id===estado.servico_id);
  if(!estado.data){
    await salvarEstado(lojaId,contato,estado);
    return 'Qual dia você prefere para '+sv.nome+'?';
  }
  const livres=await slots(lojaId,sv,estado.data,cfg);
  if(!livres.length){
    estado.hora=null;await salvarEstado(lojaId,contato,estado);
    return 'Não encontrei horários livres em '+brData(estado.data)+'. Qual outro dia você prefere?';
  }
  if(!estado.hora){
    await salvarEstado(lojaId,contato,estado);
    return 'Em '+brData(estado.data)+' tenho estes horários livres: '+livres.slice(0,6).join(', ')+'. Qual você prefere?';
  }
  if(!livres.includes(estado.hora)){
    estado.hora=null;await salvarEstado(lojaId,contato,estado);
    return 'Esse horário não está disponível. Em '+brData(estado.data)+' tenho: '+livres.slice(0,6).join(', ')+'. Qual prefere?';
  }
  if(!estado.nome){
    await salvarEstado(lojaId,contato,estado);
    return 'Perfeito. Em qual nome devo fazer o agendamento?';
  }
  estado.aguardando_confirmacao=true;await salvarEstado(lojaId,contato,estado);
  return 'Posso confirmar '+sv.nome+' para '+estado.nome+' em '+brData(estado.data)+' às '+estado.hora+'?';
}

module.exports={tentarResponder,slots};
`);

let wa=read('src/services/whatsappAtendente.service.js');
if(!wa.includes("agendaWhatsapp")){
  wa=wa.replace("const iaService = require('./ia.service');","const iaService = require('./ia.service');\nconst agendaWhatsapp = require('./agendaWhatsapp.service');");
  const old="    resposta = await iaService.responderPergunta(lojaId, texto);";
  if(!wa.includes(old))throw new Error('Hook da IA WhatsApp não encontrado');
  wa=wa.replace(old,"    resposta = await agendaWhatsapp.tentarResponder(mensagem);\n    if (!resposta) resposta = await iaService.responderPergunta(lojaId, texto);");
}
write('src/services/whatsappAtendente.service.js',wa);

let c=read('src/controllers/clienteHub.controller.js');
if(!c.includes('async function salvarAgendaConfig')){
  c=c.replace(
    "const [{data:servicos,error:e1},{data:agenda,error:e2},{data:pag,error:e3}]=await Promise.all([",
    "const [{data:servicos,error:e1},{data:agenda,error:e2},{data:pag,error:e3},{data:agendaCfg,error:e4}]=await Promise.all(["
  );
  c=c.replace(
    "supabase.from('saintsai_pagamento_config').select('*').eq('loja_id',loja.id).maybeSingle()\n    ]);\n    if(e1||e2||e3) throw (e1||e2||e3);",
    "supabase.from('saintsai_pagamento_config').select('*').eq('loja_id',loja.id).maybeSingle(),\n      supabase.from('saintsai_agenda_config').select('*').eq('loja_id',loja.id).maybeSingle()\n    ]);\n    if(e1||e2||e3||e4) throw (e1||e2||e3||e4);"
  );
  c=c.replace(
    "},metricas:{agendamentos_hoje:",
    "},agenda_config:agendaCfg||null,metricas:{agendamentos_hoje:"
  );
  c=c.replace("const permitido=['asaas','stripe','outro',null];","const permitido=['pagbank','asaas','mercadopago','outro',null];");
  const marker="async function criarAgendamento(req,res){";
  if(!c.includes(marker))throw new Error('Hook criarAgendamento não encontrado');
  const fn=`async function salvarAgendaConfig(req,res){
  try{
    const loja=await exigirLoja(req,res);if(!loja)return;
    const horarios=req.body?.horarios;
    const intervalo=Number(req.body?.intervalo_grade_min||30);
    if(!horarios||typeof horarios!=='object'||Array.isArray(horarios))return res.status(400).json({erro:'Horários inválidos.'});
    if(!Number.isInteger(intervalo)||intervalo<5||intervalo>240)return res.status(400).json({erro:'Intervalo da agenda inválido.'});
    const limpo={};
    for(let d=0;d<7;d++){
      const x=horarios[String(d)]||{};
      if(x.aberto===true){
        const ini=String(x.inicio||''),fim=String(x.fim||'');
        if(!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(ini)||!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(fim)||ini>=fim)return res.status(400).json({erro:'Confira os horários de atendimento.'});
        limpo[String(d)]={aberto:true,inicio:ini,fim:fim};
      }else limpo[String(d)]={aberto:false};
    }
    const {data,error}=await supabase.from('saintsai_agenda_config').upsert({loja_id:loja.id,timezone:'America/Sao_Paulo',intervalo_grade_min:intervalo,horarios:limpo,atualizado_em:new Date().toISOString()},{onConflict:'loja_id'}).select('*').single();
    if(error)throw error;return res.json(data);
  }catch(e){console.error('[cliente-hub] agenda config',e?.message||e);return res.status(500).json({erro:'Não foi possível salvar os horários.'});}
}

`;
  c=c.replace(marker,fn+marker);
  c=c.replace(
    "module.exports={resumo,criarServico,atualizarServico,excluirServico,salvarPagamentos,",
    "module.exports={resumo,criarServico,atualizarServico,excluirServico,salvarPagamentos,salvarAgendaConfig,"
  );
}
write('src/controllers/clienteHub.controller.js',c);

let r=read('src/routes/clienteHub.routes.js');
if(!r.includes("'/agenda-config'"))r=r.replace("r.put('/pagamentos',c.salvarPagamentos);","r.put('/pagamentos',c.salvarPagamentos);\nr.put('/agenda-config',c.salvarAgendaConfig);");
write('src/routes/clienteHub.routes.js',r);

let h=read('public/cliente-central.html');
if(!h.includes('agenda-horarios')){
  const alvo='<button class="btn" id="ag-salvar" style="margin-top:14px">Confirmar horário</button><div id="ag-status" class="muted" style="margin-top:8px"></div></div></section>';
  if(!h.includes(alvo))throw new Error('Hook da tela Agenda não encontrado');
  const dias=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const linhas=dias.map((n,i)=>'<div class="row agenda-dia" data-dia="'+i+'"><label style="min-width:100px;display:flex;align-items:center;gap:6px"><input class="ah-open" type="checkbox"> '+n+'</label><input class="ah-ini" type="time" value="09:00"><input class="ah-fim" type="time" value="'+(i===6?'13:00':'18:00')+'"></div>').join('');
  h=h.replace(alvo,'<button class="btn" id="ag-salvar" style="margin-top:14px">Confirmar horário</button><div id="ag-status" class="muted" style="margin-top:8px"></div></div><div class="panel" id="agenda-horarios" style="margin-top:12px"><h2>Horários de atendimento</h2><p class="muted">A IA só oferece horários que estiverem configurados aqui.</p>'+linhas+'<div class="field"><label>Intervalo da grade (min)</label><input id="ah-grade" type="number" min="5" max="240" value="30"></div><button class="btn" id="ah-save" style="margin-top:14px">Salvar horários</button><div id="ah-status" class="muted" style="margin-top:8px"></div></div></section>');
  h=h.replace(
    "renderServicos();renderAgenda();renderPag();",
    "renderServicos();renderAgenda();renderPag();renderAgendaConfig();"
  );
  h=h.replace(
    "function renderPag(){",
    "function renderAgendaConfig(){const cfg=dados.agenda_config||{};const hs=cfg.horarios||{};document.querySelectorAll('.agenda-dia').forEach(row=>{const x=hs[row.dataset.dia]||{};row.querySelector('.ah-open').checked=x.aberto===true;row.querySelector('.ah-ini').value=x.inicio||'09:00';row.querySelector('.ah-fim').value=x.fim||'18:00';});$('ah-grade').value=Number(cfg.intervalo_grade_min||30);}\nfunction renderPag(){"
  );
  h=h.replace(
    "$('ag-salvar').onclick=async()=>{",
    "$('ah-save').onclick=async()=>{try{const horarios={};document.querySelectorAll('.agenda-dia').forEach(row=>{horarios[row.dataset.dia]={aberto:row.querySelector('.ah-open').checked,inicio:row.querySelector('.ah-ini').value,fim:row.querySelector('.ah-fim').value};});$('ah-status').textContent='Salvando…';const cfg=await apiFetch('/lojas/'+loja.id+'/cliente-hub/agenda-config',{method:'PUT',body:JSON.stringify({horarios,intervalo_grade_min:Number($('ah-grade').value||30)})});dados.agenda_config=cfg;renderAgendaConfig();$('ah-status').textContent='Horários salvos. A IA já pode consultar esta agenda.';}catch(e){$('ah-status').textContent=e.message||'Não foi possível salvar.';}};\n$('ag-salvar').onclick=async()=>{"
  );
}
write('public/cliente-central.html',h);

cp.execFileSync(process.execPath,['--check','src/services/agendaWhatsapp.service.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','src/services/whatsappAtendente.service.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','src/controllers/clienteHub.controller.js'],{stdio:'inherit'});
console.log('Agenda determinística conectada ao WhatsApp.');
