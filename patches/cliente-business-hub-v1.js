const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

write('src/controllers/clienteHub.controller.js', `
const supabase = require('../config/supabase');

async function lojaDoUsuario(lojaId, usuarioId) {
  const { data, error } = await supabase
    .from('lojas')
    .select('id,nome,dono_id')
    .eq('id', lojaId)
    .eq('dono_id', usuarioId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function exigirLoja(req,res){
  const loja=await lojaDoUsuario(String(req.params.lojaId||''),req.usuario.id);
  if(!loja){res.status(404).json({erro:'Loja não encontrada.'});return null;}
  return loja;
}

function numero(v){const n=Number(v);return Number.isFinite(n)?n:null;}

async function resumo(req,res){
  try{
    const loja=await exigirLoja(req,res); if(!loja)return;
    const agora=new Date();
    const inicioDia=new Date(agora); inicioDia.setHours(0,0,0,0);
    const fimDia=new Date(agora); fimDia.setHours(23,59,59,999);
    const [{data:servicos,error:e1},{data:agenda,error:e2},{data:pag,error:e3}]=await Promise.all([
      supabase.from('saintsai_servicos').select('*').eq('loja_id',loja.id).order('criado_em',{ascending:true}),
      supabase.from('saintsai_agendamentos').select('*,saintsai_servicos(nome)').eq('loja_id',loja.id).gte('inicio',inicioDia.toISOString()).lte('inicio',new Date(Date.now()+30*86400000).toISOString()).order('inicio',{ascending:true}),
      supabase.from('saintsai_pagamento_config').select('*').eq('loja_id',loja.id).maybeSingle()
    ]);
    if(e1||e2||e3) throw (e1||e2||e3);
    const hoje=(agenda||[]).filter(x=>new Date(x.inicio)>=inicioDia&&new Date(x.inicio)<=fimDia&&x.status!=='cancelado');
    const recebimentosHoje=hoje.filter(x=>x.pagamento_status==='pago'||x.pagamento_status==='presencial').reduce((a,x)=>a+Number(x.valor||0),0);
    return res.json({loja:{id:loja.id,nome:loja.nome},servicos:servicos||[],agenda:agenda||[],pagamentos:pag||{
      loja_id:loja.id,provedor:null,conectado:false,aceita_pix_online:false,aceita_pix_presencial:true,aceita_dinheiro:true,aceita_cartao_presencial:true,exige_pagamento_antecipado:false,sinal_tipo:'nenhum',sinal_valor:0
    },metricas:{agendamentos_hoje:hoje.length,recebimentos_hoje:recebimentosHoje,pendentes:hoje.filter(x=>x.pagamento_status==='pendente'||x.pagamento_status==='aguardando').length}});
  }catch(e){console.error('[cliente-hub] resumo',e?.message||e);return res.status(500).json({erro:'Não foi possível carregar a central da empresa.'});}
}

async function criarServico(req,res){
  try{
    const loja=await exigirLoja(req,res); if(!loja)return;
    const nome=String(req.body?.nome||'').trim();
    const preco=numero(req.body?.preco);
    const duracao=Number(req.body?.duracao_min);
    const intervalo=Number(req.body?.intervalo_pos_min||0);
    if(!nome||nome.length>120)return res.status(400).json({erro:'Informe o nome do serviço.'});
    if(preco===null||preco<0)return res.status(400).json({erro:'Preço inválido.'});
    if(!Number.isInteger(duracao)||duracao<5||duracao>1440)return res.status(400).json({erro:'Duração inválida.'});
    if(!Number.isInteger(intervalo)||intervalo<0||intervalo>240)return res.status(400).json({erro:'Intervalo inválido.'});
    const {data,error}=await supabase.from('saintsai_servicos').insert({loja_id:loja.id,nome,descricao:String(req.body?.descricao||'').trim()||null,preco,duracao_min:duracao,intervalo_pos_min:intervalo,ativo:true}).select('*').single();
    if(error)throw error;
    return res.status(201).json(data);
  }catch(e){console.error('[cliente-hub] criar serviço',e?.message||e);return res.status(500).json({erro:'Não foi possível criar o serviço.'});}
}

async function atualizarServico(req,res){
  try{
    const loja=await exigirLoja(req,res); if(!loja)return;
    const dados={atualizado_em:new Date().toISOString()};
    if(req.body?.nome!==undefined){const n=String(req.body.nome||'').trim();if(!n)return res.status(400).json({erro:'Nome inválido.'});dados.nome=n;}
    if(req.body?.preco!==undefined){const p=numero(req.body.preco);if(p===null||p<0)return res.status(400).json({erro:'Preço inválido.'});dados.preco=p;}
    if(req.body?.duracao_min!==undefined){const d=Number(req.body.duracao_min);if(!Number.isInteger(d)||d<5||d>1440)return res.status(400).json({erro:'Duração inválida.'});dados.duracao_min=d;}
    if(req.body?.intervalo_pos_min!==undefined){const i=Number(req.body.intervalo_pos_min);if(!Number.isInteger(i)||i<0||i>240)return res.status(400).json({erro:'Intervalo inválido.'});dados.intervalo_pos_min=i;}
    if(req.body?.ativo!==undefined)dados.ativo=Boolean(req.body.ativo);
    const {data,error}=await supabase.from('saintsai_servicos').update(dados).eq('id',req.params.servicoId).eq('loja_id',loja.id).select('*').maybeSingle();
    if(error)throw error;if(!data)return res.status(404).json({erro:'Serviço não encontrado.'});return res.json(data);
  }catch(e){return res.status(500).json({erro:'Não foi possível atualizar o serviço.'});}
}

async function excluirServico(req,res){
  try{const loja=await exigirLoja(req,res);if(!loja)return;const {error}=await supabase.from('saintsai_servicos').delete().eq('id',req.params.servicoId).eq('loja_id',loja.id);if(error)throw error;return res.status(204).end();}
  catch(e){return res.status(500).json({erro:'Não foi possível excluir o serviço.'});}
}

async function salvarPagamentos(req,res){
  try{
    const loja=await exigirLoja(req,res);if(!loja)return;
    const permitido=['asaas','stripe','outro',null];
    const provedor=req.body?.provedor?String(req.body.provedor):null;
    if(!permitido.includes(provedor))return res.status(400).json({erro:'Provedor inválido.'});
    const sinalTipo=['nenhum','fixo','percentual'].includes(String(req.body?.sinal_tipo||''))?String(req.body.sinal_tipo):'nenhum';
    const sinalValor=Math.max(0,Number(req.body?.sinal_valor||0));
    const payload={loja_id:loja.id,provedor,conectado:false,aceita_pix_online:Boolean(req.body?.aceita_pix_online),aceita_pix_presencial:Boolean(req.body?.aceita_pix_presencial),aceita_dinheiro:Boolean(req.body?.aceita_dinheiro),aceita_cartao_presencial:Boolean(req.body?.aceita_cartao_presencial),exige_pagamento_antecipado:Boolean(req.body?.exige_pagamento_antecipado),sinal_tipo:sinalTipo,sinal_valor:sinalValor,atualizado_em:new Date().toISOString()};
    const {data,error}=await supabase.from('saintsai_pagamento_config').upsert(payload,{onConflict:'loja_id'}).select('*').single();
    if(error)throw error;return res.json(data);
  }catch(e){console.error('[cliente-hub] pagamentos',e?.message||e);return res.status(500).json({erro:'Não foi possível salvar as formas de pagamento.'});}
}

async function criarAgendamento(req,res){
  try{
    const loja=await exigirLoja(req,res);if(!loja)return;
    const {data:servico,error:es}=await supabase.from('saintsai_servicos').select('*').eq('id',req.body?.servico_id).eq('loja_id',loja.id).eq('ativo',true).maybeSingle();
    if(es)throw es;if(!servico)return res.status(400).json({erro:'Serviço inválido.'});
    const inicio=new Date(req.body?.inicio);if(Number.isNaN(inicio.getTime()))return res.status(400).json({erro:'Horário inválido.'});
    const fim=new Date(inicio.getTime()+(Number(servico.duracao_min)+Number(servico.intervalo_pos_min||0))*60000);
    const {data:conflitos,error:ec}=await supabase.from('saintsai_agendamentos').select('id').eq('loja_id',loja.id).neq('status','cancelado').lt('inicio',fim.toISOString()).gt('fim',inicio.toISOString()).limit(1);
    if(ec)throw ec;if((conflitos||[]).length)return res.status(409).json({erro:'Esse horário já está ocupado.'});
    const metodo=String(req.body?.pagamento_metodo||'presencial');
    const permitidos=['pix_online','pix_presencial','dinheiro','cartao_presencial','presencial'];
    if(!permitidos.includes(metodo))return res.status(400).json({erro:'Forma de pagamento inválida.'});
    const statusPagamento=metodo==='pix_online'?'aguardando':'presencial';
    const {data,error}=await supabase.from('saintsai_agendamentos').insert({loja_id:loja.id,servico_id:servico.id,cliente_nome:String(req.body?.cliente_nome||'').trim()||'Cliente',cliente_whatsapp:String(req.body?.cliente_whatsapp||'').trim()||null,inicio:inicio.toISOString(),fim:fim.toISOString(),valor:Number(servico.preco||0),status:metodo==='pix_online'?'pendente':'confirmado',pagamento_metodo:metodo,pagamento_status:statusPagamento}).select('*').single();
    if(error)throw error;return res.status(201).json(data);
  }catch(e){console.error('[cliente-hub] agendamento',e?.message||e);return res.status(500).json({erro:'Não foi possível criar o agendamento.'});}
}

async function atualizarAgendamento(req,res){
  try{const loja=await exigirLoja(req,res);if(!loja)return;const dados={atualizado_em:new Date().toISOString()};if(req.body?.status!==undefined)dados.status=String(req.body.status);if(req.body?.pagamento_status!==undefined)dados.pagamento_status=String(req.body.pagamento_status);const {data,error}=await supabase.from('saintsai_agendamentos').update(dados).eq('id',req.params.agendamentoId).eq('loja_id',loja.id).select('*').maybeSingle();if(error)throw error;if(!data)return res.status(404).json({erro:'Agendamento não encontrado.'});return res.json(data);}
  catch(e){return res.status(500).json({erro:'Não foi possível atualizar o agendamento.'});}
}

module.exports={resumo,criarServico,atualizarServico,excluirServico,salvarPagamentos,criarAgendamento,atualizarAgendamento};
`);

write('src/routes/clienteHub.routes.js', `
const express=require('express');
const { exigirLogin }=require('../middleware/auth');
const c=require('../controllers/clienteHub.controller');
const r=express.Router({mergeParams:true});
r.use(exigirLogin);
r.get('/',c.resumo);
r.post('/servicos',c.criarServico);
r.put('/servicos/:servicoId',c.atualizarServico);
r.delete('/servicos/:servicoId',c.excluirServico);
r.put('/pagamentos',c.salvarPagamentos);
r.post('/agendamentos',c.criarAgendamento);
r.put('/agendamentos/:agendamentoId',c.atualizarAgendamento);
module.exports=r;
`);

let app=read('src/app.js');
if(!app.includes("clienteHubRoutes")){
  const reqAnchor="const adminRoutes = require('./routes/admin.routes');";
  if(!app.includes(reqAnchor))throw new Error('Anchor de rotas não encontrado');
  app=app.replace(reqAnchor,reqAnchor+"\nconst clienteHubRoutes = require('./routes/clienteHub.routes');");
  const useAnchor="app.use('/api/lojas/:lojaId/assinatura', assinaturasRoutes);";
  if(!app.includes(useAnchor))throw new Error('Anchor de app.use não encontrado');
  app=app.replace(useAnchor,useAnchor+"\napp.use('/api/lojas/:lojaId/cliente-hub', clienteHubRoutes);");
}
write('src/app.js',app);

let login=read('public/login.html');
login=login.replace("['dashboard.html', 'whatsapp.html', 'cliente-estoque.html']","['dashboard.html', 'whatsapp.html', 'cliente-estoque.html', 'cliente-central.html']");
write('public/login.html',login);

write('public/cliente-central.html', `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#09070f">
<title>SaintsAI Cliente</title>
<link rel="stylesheet" href="css/styles.css"><script src="js/theme.js"></script><script src="js/guard.js"></script>
<style>
*{box-sizing:border-box}body{margin:0;background:#09070f;color:#fff;font-family:Manrope,system-ui,sans-serif}.app{max-width:900px;margin:auto;padding:18px 14px 96px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:18px}.brand{font-size:22px;font-weight:900}.muted{color:#a9a3b4}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card,.panel{background:#12101a;border:1px solid #2b2240;border-radius:18px;padding:15px}.value{font-size:25px;font-weight:900;margin-top:6px}.modules{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:12px}.module{border:1px solid #33264b;background:#15111f;color:#fff;border-radius:16px;padding:16px;text-align:left;font:inherit;font-weight:800}.module small{display:block;color:#aaa2b7;font-weight:500;margin-top:4px}.module.active{background:linear-gradient(135deg,#5d20d6,#8f3cff)}.section{display:none;margin-top:16px}.section.active{display:block}.row{display:flex;gap:10px;flex-wrap:wrap}.field{display:flex;flex-direction:column;gap:6px;flex:1;min-width:140px;margin-top:12px}.field input,.field select{background:#09070f;border:1px solid #3b2e53;color:white;border-radius:12px;padding:12px;font:inherit}.btn{border:0;border-radius:12px;padding:12px 14px;background:#7c35ff;color:white;font-weight:800}.btn2{border:1px solid #3b2e53;border-radius:12px;padding:11px 13px;background:#17131f;color:white;font-weight:700}.item{padding:13px 0;border-bottom:1px solid #2a2234}.item:last-child{border:0}.badge{display:inline-block;padding:4px 8px;border-radius:99px;background:#241936;color:#cdb8ff;font-size:12px}.bottom{position:fixed;left:0;right:0;bottom:0;background:rgba(9,7,15,.96);border-top:1px solid #2b2240;padding:10px max(12px,env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom));display:flex;justify-content:center}.bottom-inner{width:min(900px,100%);display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.nav{border:0;background:transparent;color:#aaa2b7;padding:8px 4px;font-size:12px}.nav.on{color:#b98cff}.switches label{display:flex;gap:9px;align-items:center;margin:10px 0}.notice{padding:12px;border-radius:12px;background:#191126;border:1px solid #42266b;color:#d9c9ff;margin-top:12px}@media(max-width:620px){.cards{grid-template-columns:1fr 1fr}.cards .card:last-child{grid-column:1/-1}}
</style></head><body><div class="app">
<div class="top"><div><div class="brand">SaintsAI Cliente</div><div id="loja-nome" class="muted">Carregando sua empresa…</div></div><button class="btn2" onclick="fazerLogout()">Sair</button></div>
<div class="cards"><div class="card"><div class="muted">Agendamentos hoje</div><div class="value" id="m-ag">0</div></div><div class="card"><div class="muted">Recebimentos</div><div class="value" id="m-rec">R$ 0</div></div><div class="card"><div class="muted">Pendentes</div><div class="value" id="m-pen">0</div></div></div>
<div class="modules"><button class="module active" data-sec="inicio">▦ Início<small>Resumo do negócio</small></button><button class="module" data-sec="agenda">▣ Agenda<small>Horários e reservas</small></button><button class="module" data-sec="servicos">◆ Serviços<small>Preços e duração</small></button><button class="module" data-sec="pagamentos">▤ Pagamentos<small>Online e presencial</small></button></div>

<section id="inicio" class="section active"><div class="panel"><h2>Próximos agendamentos</h2><div id="lista-agenda"></div></div><div class="panel" style="margin-top:12px"><h2>Outros módulos</h2><div class="row"><a class="btn2" href="cliente-estoque.html" style="text-decoration:none">Estoque (opcional)</a><a class="btn2" href="cliente-estoque.html?secao=agente" style="text-decoration:none">Agente IA</a></div></div></section>

<section id="agenda" class="section"><div class="panel"><h2>Novo agendamento</h2><div class="row"><div class="field"><label>Cliente</label><input id="ag-cliente" placeholder="Nome do cliente"></div><div class="field"><label>Serviço</label><select id="ag-servico"></select></div></div><div class="row"><div class="field"><label>Data e hora</label><input id="ag-inicio" type="datetime-local"></div><div class="field"><label>Pagamento</label><select id="ag-pag"><option value="dinheiro">Dinheiro na hora</option><option value="pix_presencial">Pix presencial</option><option value="cartao_presencial">Cartão presencial</option><option value="pix_online">Pix online</option></select></div></div><button class="btn" id="ag-salvar" style="margin-top:14px">Confirmar horário</button><div id="ag-status" class="muted" style="margin-top:8px"></div></div></section>

<section id="servicos" class="section"><div class="panel"><h2>Serviços</h2><div class="row"><div class="field"><label>Nome</label><input id="sv-nome" placeholder="Ex.: Consulta"></div><div class="field"><label>Preço</label><input id="sv-preco" type="number" min="0" step=".01"></div></div><div class="row"><div class="field"><label>Duração (min)</label><input id="sv-dur" type="number" min="5" value="30"></div><div class="field"><label>Intervalo após serviço</label><input id="sv-int" type="number" min="0" value="0"></div></div><button class="btn" id="sv-add" style="margin-top:14px">Adicionar serviço</button><div id="sv-status" class="muted" style="margin-top:8px"></div><div id="lista-servicos"></div></div></section>

<section id="pagamentos" class="section"><div class="panel"><h2>Formas de pagamento</h2><p class="muted">O horário pode ser confirmado com pagamento presencial. Pagamento online é uma opção separada.</p><div class="switches"><label><input type="checkbox" id="p-din"> Dinheiro na hora</label><label><input type="checkbox" id="p-pixp"> Pix presencial</label><label><input type="checkbox" id="p-cart"> Cartão presencial</label><label><input type="checkbox" id="p-pixo"> Pix online / automático</label></div><div class="field"><label>Provedor do pagamento automático</label><select id="p-prov"><option value="">Escolher depois</option><option value="asaas">Asaas</option><option value="stripe">Stripe</option><option value="outro">Outro</option></select></div><label style="display:flex;gap:9px;align-items:center;margin-top:14px"><input type="checkbox" id="p-antec"> Exigir pagamento antecipado para confirmar</label><div class="row"><div class="field"><label>Sinal</label><select id="p-sinal-t"><option value="nenhum">Sem sinal</option><option value="fixo">Valor fixo</option><option value="percentual">Percentual</option></select></div><div class="field"><label>Valor do sinal</label><input id="p-sinal-v" type="number" min="0" step=".01" value="0"></div></div><div class="row" style="margin-top:14px"><button class="btn" id="p-save">Salvar formas</button><button class="btn2" id="p-connect">Conectar pagamento automático</button></div><div id="p-status" class="muted" style="margin-top:8px"></div><div class="notice">A conexão automática será feita com autorização segura do provedor. Nenhuma chave secreta será salva no aplicativo.</div></div></section>
</div>
<div class="bottom"><div class="bottom-inner"><button class="nav on" data-sec="inicio">Início</button><button class="nav" data-sec="agenda">Agenda</button><button class="nav" data-sec="servicos">Serviços</button><button class="nav" data-sec="pagamentos">Pagamentos</button><button class="nav" onclick="location.href='cliente-estoque.html?secao=agente'">IA</button></div></div>
<script src="js/config.js"></script><script src="js/auth.js"></script><script src="js/api.js"></script><script src="js/loja.js"></script>
<script>
let loja=null,dados=null;
const $=id=>document.getElementById(id);
function dinheiro(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function trocar(sec){document.querySelectorAll('.section').forEach(x=>x.classList.toggle('active',x.id===sec));document.querySelectorAll('[data-sec]').forEach(x=>{if(x.classList.contains('module'))x.classList.toggle('active',x.dataset.sec===sec);if(x.classList.contains('nav'))x.classList.toggle('on',x.dataset.sec===sec)});}
document.querySelectorAll('[data-sec]').forEach(b=>b.addEventListener('click',()=>trocar(b.dataset.sec)));
async function carregar(){
 try{loja=await obterLojaAtual();if(!loja)throw new Error('Nenhuma empresa encontrada.');dados=await apiFetch('/lojas/'+loja.id+'/cliente-hub');$('loja-nome').textContent=dados.loja.nome;$('m-ag').textContent=dados.metricas.agendamentos_hoje;$('m-rec').textContent=dinheiro(dados.metricas.recebimentos_hoje);$('m-pen').textContent=dados.metricas.pendentes;renderServicos();renderAgenda();renderPag();}
 catch(e){if(e instanceof SessaoExpiradaError)return fazerLogout();$('loja-nome').textContent=e.message||'Falha ao carregar.';}
}
function renderServicos(){const arr=dados.servicos||[];$('lista-servicos').innerHTML=arr.length?arr.map(s=>'<div class="item"><strong>'+s.nome+'</strong><div class="muted">'+dinheiro(s.preco)+' · '+s.duracao_min+' min'+(s.intervalo_pos_min?' + '+s.intervalo_pos_min+' min de intervalo':'')+'</div></div>').join(''):'<div class="muted" style="margin-top:14px">Nenhum serviço cadastrado.</div>';$('ag-servico').innerHTML=arr.filter(x=>x.ativo).map(s=>'<option value="'+s.id+'">'+s.nome+' · '+dinheiro(s.preco)+'</option>').join('');}
function renderAgenda(){const arr=dados.agenda||[];$('lista-agenda').innerHTML=arr.length?arr.slice(0,8).map(a=>'<div class="item"><strong>'+new Date(a.inicio).toLocaleString('pt-BR')+' · '+a.cliente_nome+'</strong><div class="muted">'+(a.saintsai_servicos?.nome||'Serviço')+' · '+dinheiro(a.valor)+' · <span class="badge">'+a.pagamento_status+'</span></div></div>').join(''):'<div class="muted">Nenhum agendamento próximo.</div>';}
function renderPag(){const p=dados.pagamentos||{};$('p-din').checked=!!p.aceita_dinheiro;$('p-pixp').checked=!!p.aceita_pix_presencial;$('p-cart').checked=!!p.aceita_cartao_presencial;$('p-pixo').checked=!!p.aceita_pix_online;$('p-prov').value=p.provedor||'';$('p-antec').checked=!!p.exige_pagamento_antecipado;$('p-sinal-t').value=p.sinal_tipo||'nenhum';$('p-sinal-v').value=Number(p.sinal_valor||0);}
$('sv-add').onclick=async()=>{try{$('sv-status').textContent='Salvando…';await apiFetch('/lojas/'+loja.id+'/cliente-hub/servicos',{method:'POST',body:JSON.stringify({nome:$('sv-nome').value,preco:$('sv-preco').value,duracao_min:Number($('sv-dur').value),intervalo_pos_min:Number($('sv-int').value)})});$('sv-status').textContent='Serviço adicionado.';await carregar();}catch(e){$('sv-status').textContent=e.message||'Falha ao salvar.';}};
$('ag-salvar').onclick=async()=>{try{$('ag-status').textContent='Confirmando…';await apiFetch('/lojas/'+loja.id+'/cliente-hub/agendamentos',{method:'POST',body:JSON.stringify({cliente_nome:$('ag-cliente').value,servico_id:$('ag-servico').value,inicio:$('ag-inicio').value,pagamento_metodo:$('ag-pag').value})});$('ag-status').textContent='Horário confirmado.';await carregar();}catch(e){$('ag-status').textContent=e.message||'Falha ao agendar.';}};
$('p-save').onclick=async()=>{try{$('p-status').textContent='Salvando…';const p=await apiFetch('/lojas/'+loja.id+'/cliente-hub/pagamentos',{method:'PUT',body:JSON.stringify({provedor:$('p-prov').value||null,aceita_dinheiro:$('p-din').checked,aceita_pix_presencial:$('p-pixp').checked,aceita_cartao_presencial:$('p-cart').checked,aceita_pix_online:$('p-pixo').checked,exige_pagamento_antecipado:$('p-antec').checked,sinal_tipo:$('p-sinal-t').value,sinal_valor:Number($('p-sinal-v').value||0)})});dados.pagamentos=p;renderPag();$('p-status').textContent='Formas de pagamento salvas.';}catch(e){$('p-status').textContent=e.message||'Falha ao salvar.';}};
$('p-connect').onclick=()=>{$('p-status').textContent='Escolha o provedor e salve. A autorização segura da conta será ativada na próxima etapa da integração.';};
carregar();
</script></body></html>`);

console.log('Central SaintsAI Cliente v1 aplicada.');
