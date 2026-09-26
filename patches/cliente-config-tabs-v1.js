const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

/* API dedicada para a etapa IA, sem apagar o bloco gerenciado de personalidade/avisos */
let c=read('src/controllers/clienteHub.controller.js');
if(!c.includes('async function obterConfiguracaoIa')){
  const insert=`
function separarPromptCliente(prompt){
  const s=String(prompt||'');
  const ini='[SAINTSAI_CONFIG_CLIENTE]';
  const fim='[/SAINTSAI_CONFIG_CLIENTE]';
  const a=s.indexOf(ini);
  const b=a>=0?s.indexOf(fim,a):-1;
  if(a<0||b<0)return {base:s.trim(),gerenciado:''};
  const end=b+fim.length;
  const gerenciado=s.slice(a,end);
  const base=(s.slice(0,a)+String.fromCharCode(10)+s.slice(end)).trim();
  return {base,gerenciado};
}
async function obterConfiguracaoIa(req,res){
  try{
    const loja=await exigirLoja(req,res);if(!loja)return;
    const {data,error}=await supabase.from('lojas').select('prompt_mestre').eq('id',loja.id).eq('dono_id',req.usuario.id).maybeSingle();
    if(error)throw error;
    return res.json({prompt:separarPromptCliente(data?.prompt_mestre).base});
  }catch(e){return res.status(500).json({erro:'Não foi possível carregar a configuração da IA.'});}
}
async function salvarConfiguracaoIa(req,res){
  try{
    const loja=await exigirLoja(req,res);if(!loja)return;
    const prompt=String(req.body?.prompt||'').trim();
    if(prompt.length<40)return res.status(400).json({erro:'Descreva melhor sua empresa, produtos/serviços e regras de atendimento.'});
    if(prompt.length>12000)return res.status(400).json({erro:'A configuração da IA ficou grande demais.'});
    const {data:atual,error:ea}=await supabase.from('lojas').select('prompt_mestre').eq('id',loja.id).eq('dono_id',req.usuario.id).maybeSingle();
    if(ea)throw ea;
    const gerenciado=separarPromptCliente(atual?.prompt_mestre).gerenciado;
    const final=[prompt,gerenciado].filter(Boolean).join(String.fromCharCode(10,10));
    const {error}=await supabase.from('lojas').update({prompt_mestre:final}).eq('id',loja.id).eq('dono_id',req.usuario.id);
    if(error)throw error;
    return res.json({ok:true,prompt});
  }catch(e){console.error('[cliente-hub] config ia',e?.message||e);return res.status(500).json({erro:'Não foi possível salvar a configuração da IA.'});}
}
`;
  const exp=c.lastIndexOf('module.exports=');
  if(exp<0)throw new Error('Export clienteHub não encontrado');
  c=c.slice(0,exp)+insert+'\n'+c.slice(exp);
  c=c.replace(/module\.exports=\{([^}]*)\}/,(m,inside)=>{
    if(inside.includes('obterConfiguracaoIa'))return m;
    return 'module.exports={'+inside.trim().replace(/,$/,'')+',obterConfiguracaoIa,salvarConfiguracaoIa}';
  });
}
write('src/controllers/clienteHub.controller.js',c);

let r=read('src/routes/clienteHub.routes.js');
if(!r.includes("'/config-ia'")){
  const anchor="r.get('/onboarding',c.onboardingCliente);";
  if(!r.includes(anchor))throw new Error('Rota onboarding não encontrada');
  r=r.replace(anchor,anchor+"\nr.get('/config-ia',c.obterConfiguracaoIa);\nr.put('/config-ia',c.salvarConfiguracaoIa);");
}
write('src/routes/clienteHub.routes.js',r);

/* Página separada: uma etapa por aba/tela */
write('public/cliente-configuracao.html', `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#08070d">
<title>Configuração · SaintsAI Cliente</title>
<link rel="stylesheet" href="css/styles.css"><script src="js/theme.js"></script><script src="js/guard.js"></script>
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#08070d;color:#fff;font-family:Manrope,system-ui,sans-serif}
body{background:radial-gradient(circle at 50% -10%,rgba(126,53,235,.18),transparent 34%),#08070d}
.shell{max-width:820px;margin:auto;padding:calc(16px + env(safe-area-inset-top)) 14px calc(34px + env(safe-area-inset-bottom))}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
.back{border:1px solid rgba(255,255,255,.08);background:#14111c;color:#fff;border-radius:14px;padding:11px 14px;font:inherit;font-weight:800}
.brand{font-weight:950;font-size:18px}.company{font-size:12px;color:#968fa0;margin-top:3px}.top-spacer{width:76px}
.head-card{border:1px solid rgba(158,95,255,.23);background:linear-gradient(145deg,rgba(36,18,58,.96),rgba(16,12,24,.98));border-radius:24px;padding:20px;margin-bottom:12px}
.kicker{font-size:10px;font-weight:950;letter-spacing:.15em;color:#a766ff;text-transform:uppercase}.head-card h1{font-size:25px;margin:7px 0 7px;letter-spacing:-.035em}.head-card p{margin:0;color:#aaa2b5;font-size:13px;line-height:1.5}
.progress{height:7px;background:rgba(255,255,255,.07);border-radius:99px;margin-top:16px;overflow:hidden}.progress>i{display:block;height:100%;background:linear-gradient(90deg,#8537ef,#c078ff);border-radius:99px}
.tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:12px 0;overflow-x:auto}
.tab{min-width:0;border:1px solid rgba(255,255,255,.07);background:#111018;color:#877f91;border-radius:13px;padding:10px 5px;text-decoration:none;text-align:center;font-size:10px;font-weight:850}
.tab.on{color:#fff;background:rgba(124,58,237,.23);border-color:rgba(166,103,255,.28)}.tab.done:before{content:'✓ ';color:#70dda9}
.card{border:1px solid rgba(255,255,255,.075);background:linear-gradient(180deg,#121019,#0d0b12);border-radius:22px;padding:18px}
.card h2{font-size:20px;margin:0 0 6px}.muted{color:#9a92a5;font-size:13px;line-height:1.5}.field{display:flex;flex-direction:column;gap:7px;margin-top:14px}.field label{font-size:12px;font-weight:850;color:#c0b8ca}
input,select,textarea{width:100%;background:#09080d;border:1px solid rgba(255,255,255,.1);color:#fff;border-radius:14px;padding:13px;font:inherit}textarea{min-height:180px;resize:vertical}input:focus,select:focus,textarea:focus{outline:none;border-color:#8f52e9;box-shadow:0 0 0 3px rgba(124,58,237,.12)}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.checks{display:grid;gap:9px;margin-top:14px}.check{display:flex;align-items:center;gap:9px;padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(255,255,255,.025)}.check input{width:auto}
.btns{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}.btn{border:0;border-radius:14px;min-height:47px;padding:0 15px;background:linear-gradient(135deg,#7937ed,#ad55ff);color:#fff;font:inherit;font-weight:900}.btn.secondary{border:1px solid rgba(255,255,255,.08);background:#17131f}.btn.ghost{border:1px solid rgba(255,255,255,.08);background:transparent;color:#b8afc4}
.status{min-height:20px;margin-top:10px;color:#c5a7ef;font-size:12px}.list{margin-top:14px}.item{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.06)}.item:last-child{border-bottom:0}.item-title{font-weight:850}.item-sub{font-size:11px;color:#8f879d;margin-top:4px}.delete{border:1px solid rgba(255,105,120,.16);background:rgba(255,105,120,.07);color:#ff9ca6;border-radius:10px;padding:8px 10px}
.days{display:grid;gap:8px;margin-top:14px}.day{display:grid;grid-template-columns:110px 1fr 1fr;gap:8px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.06);border-radius:14px}.day label{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800}.day input[type=checkbox]{width:auto}.nav-actions{display:flex;justify-content:space-between;gap:10px;margin-top:14px}.nav-actions .btn{flex:1}
.notice{margin-top:13px;padding:13px;border-radius:14px;background:rgba(117,54,205,.09);border:1px solid rgba(154,94,247,.16);color:#b7aec4;font-size:12px;line-height:1.5}
.hidden{display:none!important}
@media(max-width:560px){.shell{padding-left:12px;padding-right:12px}.tabs{grid-template-columns:repeat(5,minmax(76px,1fr));padding-bottom:2px}.head-card{padding:17px}.head-card h1{font-size:22px}.row{grid-template-columns:1fr}.day{grid-template-columns:1fr 1fr}.day label{grid-column:1/-1}.top-spacer{display:none}}
</style></head><body><div class="shell">
<header class="top"><button class="back" id="voltar">← Início</button><div style="text-align:center"><div class="brand">Configuração SaintsAI</div><div class="company" id="company">Carregando…</div></div><div class="top-spacer"></div></header>
<div class="head-card"><div class="kicker" id="kicker">ETAPA</div><h1 id="title">Configuração</h1><p id="desc"></p><div class="progress"><i id="bar" style="width:0%"></i></div></div>
<nav class="tabs" id="tabs"></nav>
<main class="card" id="content"><div class="muted">Carregando configuração…</div></main>
<div class="nav-actions"><button class="btn secondary" id="prev">Etapa anterior</button><button class="btn" id="next">Próxima etapa</button></div>
</div>
<script src="js/config.js"></script><script src="js/auth.js"></script><script src="js/api.js"></script><script src="js/loja.js"></script>
<script>
const etapas=[
 {id:'ia',nome:'IA',titulo:'Configure a IA',desc:'Explique o que sua empresa faz, o que oferece e quais regras a IA deve seguir.'},
 {id:'servicos',nome:'Itens',titulo:'Itens e serviços',desc:'Cadastre livremente o que você vende ou agenda, com nome, preço e detalhes.'},
 {id:'pagamentos',nome:'Pagamentos',titulo:'Pagamentos',desc:'Escolha formas de pagamento e conecte o PagBank quando quiser receber automaticamente.'},
 {id:'agenda',nome:'Agenda',titulo:'Agenda',desc:'Defina os dias e horários em que a IA pode oferecer agendamentos.'},
 {id:'operacao',nome:'WhatsApp',titulo:'WhatsApp e teste',desc:'Conecte o número e teste o atendimento antes de divulgar.'}
];
const $=id=>document.getElementById(id);let loja=null,resumo=null,onboarding=null;
function etapaAtual(){const q=new URLSearchParams(location.search).get('etapa');return etapas.find(e=>e.id===q)||etapas[0]}
function dinheiro(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function ir(id){location.href='cliente-configuracao.html?etapa='+encodeURIComponent(id)}
function renderTabs(){
 const atual=etapaAtual();const done=new Set((onboarding?.etapas||[]).filter(e=>e.concluida).map(e=>e.id));
 $('tabs').innerHTML=etapas.map(e=>'<a class="tab '+(e.id===atual.id?'on ':'')+(done.has(e.id)?'done':'')+'" href="cliente-configuracao.html?etapa='+e.id+'">'+e.nome+'</a>').join('');
 const idx=etapas.findIndex(e=>e.id===atual.id);$('prev').disabled=idx===0;$('prev').style.opacity=idx===0?'.45':'1';$('prev').onclick=()=>{if(idx>0)ir(etapas[idx-1].id)};$('next').textContent=idx===etapas.length-1?'Voltar ao início':'Próxima etapa';$('next').onclick=()=>idx===etapas.length-1?location.href='cliente-central.html':ir(etapas[idx+1].id);
 $('kicker').textContent='ETAPA '+(idx+1)+' DE '+etapas.length;$('title').textContent=atual.titulo;$('desc').textContent=atual.desc;$('bar').style.width=Number(onboarding?.percentual||0)+'%';
}
async function carregar(){
 try{
  loja=await obterLojaAtual();if(!loja)throw new Error('Nenhuma empresa encontrada.');
  [resumo,onboarding]=await Promise.all([apiFetch('/lojas/'+loja.id+'/cliente-hub'),apiFetch('/lojas/'+loja.id+'/cliente-hub/onboarding')]);
  $('company').textContent=resumo.loja?.nome||loja.nome||'Sua empresa';renderTabs();await renderEtapa();
 }catch(e){if(e instanceof SessaoExpiradaError)return fazerLogout();$('content').innerHTML='<div class="muted">'+esc(e.message||'Não foi possível carregar.')+'</div>'}
}
async function renderEtapa(){
 const id=etapaAtual().id;
 if(id==='ia')return renderIa();
 if(id==='servicos')return renderServicos();
 if(id==='pagamentos')return renderPagamentos();
 if(id==='agenda')return renderAgenda();
 return renderOperacao();
}
async function renderIa(){
 let cfg={prompt:''};try{cfg=await apiFetch('/lojas/'+loja.id+'/cliente-hub/config-ia')}catch(_){}
 $('content').innerHTML='<h2>Sobre sua empresa e a IA</h2><p class="muted">Escreva em linguagem normal. Informe o que sua empresa faz, o que vende, preços ou regras importantes, horários, entrega/retirada e como você quer que a IA atenda.</p><div class="field"><label>Informações e regras da empresa</label><textarea id="ia-prompt" placeholder="Ex.: Somos uma esmalteria...">'+esc(cfg.prompt||'')+'</textarea></div><div class="btns"><button class="btn secondary" id="ia-melhorar">✨ Aprimorar com IA</button><button class="btn" id="ia-save">Salvar IA</button></div><div class="status" id="ia-status"></div>';
 $('ia-melhorar').onclick=async()=>{const st=$('ia-status'),b=$('ia-melhorar');try{const p=$('ia-prompt').value.trim();if(!p){st.textContent='Escreva primeiro as informações da empresa.';return;}b.disabled=true;st.textContent='Aprimorando…';const x=await apiFetch('/aprimorar-prompt',{method:'POST',body:JSON.stringify({prompt:p})});if(x.prompt_aprimorado)$('ia-prompt').value=x.prompt_aprimorado;st.textContent='Pronto. Revise e salve.';}catch(e){st.textContent=e.message||'Não foi possível aprimorar.';}finally{b.disabled=false;}};
 $('ia-save').onclick=async()=>{const st=$('ia-status');try{st.textContent='Salvando…';await apiFetch('/lojas/'+loja.id+'/cliente-hub/config-ia',{method:'PUT',body:JSON.stringify({prompt:$('ia-prompt').value})});st.textContent='IA configurada.';await recarregarProgresso();}catch(e){st.textContent=e.message||'Não foi possível salvar.';}};
}
function renderServicos(){
 const arr=resumo.servicos||[];
 $('content').innerHTML='<h2>Itens e serviços</h2><p class="muted">Não há categoria fixa. Pode ser corte, unha, consulta, produto, instalação ou qualquer outro item.</p><div class="field"><label>Nome</label><input id="sv-nome" placeholder="Ex.: Unha em gel"></div><div class="field"><label>Descrição para a IA</label><input id="sv-desc" placeholder="Ex.: inclui preparação e acabamento"></div><div class="row"><div class="field"><label>Preço</label><input id="sv-preco" type="number" min="0" step=".01"></div><div class="field"><label>Duração (min)</label><input id="sv-dur" type="number" min="5" value="30"></div></div><div class="field"><label>Intervalo depois (min)</label><input id="sv-int" type="number" min="0" value="0"></div><div class="btns"><button class="btn" id="sv-add">Adicionar item</button></div><div class="status" id="sv-status"></div><div class="list" id="sv-list"></div>';renderListaServicos();
 $('sv-add').onclick=async()=>{const st=$('sv-status');try{st.textContent='Salvando…';await apiFetch('/lojas/'+loja.id+'/cliente-hub/servicos',{method:'POST',body:JSON.stringify({nome:$('sv-nome').value,descricao:$('sv-desc').value,preco:$('sv-preco').value,duracao_min:Number($('sv-dur').value),intervalo_pos_min:Number($('sv-int').value)})});await refreshResumo();renderServicos();await recarregarProgresso();}catch(e){st.textContent=e.message||'Não foi possível salvar.';}};
}
function renderListaServicos(){
 const el=$('sv-list');if(!el)return;const arr=resumo.servicos||[];el.innerHTML=arr.length?arr.map(s=>'<div class="item"><div><div class="item-title">'+esc(s.nome)+'</div><div class="item-sub">'+dinheiro(s.preco)+' · '+Number(s.duracao_min||0)+' min'+(s.descricao?' · '+esc(s.descricao):'')+'</div></div><button class="delete" data-del="'+s.id+'">Excluir</button></div>').join(''):'<div class="muted">Nenhum item cadastrado ainda.</div>';el.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este item?'))return;await apiFetch('/lojas/'+loja.id+'/cliente-hub/servicos/'+b.dataset.del,{method:'DELETE'});await refreshResumo();renderServicos();await recarregarProgresso();});
}
function renderPagamentos(){
 const p=resumo.pagamentos||{};
 $('content').innerHTML='<h2>Formas de pagamento</h2><p class="muted">Você pode aceitar pagamentos presenciais e, quando disponível, conectar o PagBank para Pix automático.</p><div class="checks"><label class="check"><input id="p-din" type="checkbox"> Dinheiro</label><label class="check"><input id="p-pixp" type="checkbox"> Pix presencial</label><label class="check"><input id="p-cart" type="checkbox"> Cartão presencial</label><label class="check"><input id="p-pixo" type="checkbox"> Pix online / automático</label><label class="check"><input id="p-antec" type="checkbox"> Exigir pagamento antecipado</label></div><div class="row"><div class="field"><label>Sinal</label><select id="p-sinal-t"><option value="nenhum">Sem sinal</option><option value="fixo">Valor fixo</option><option value="percentual">Percentual</option></select></div><div class="field"><label>Valor do sinal</label><input id="p-sinal-v" type="number" min="0" step=".01"></div></div><div class="notice" id="p-conn">'+(p.conectado?esc(p.provedor_conta_resumo||'Pagamento automático conectado.'):'PagBank ainda não conectado.')+'</div><div class="btns"><button class="btn" id="p-save">Salvar formas</button><button class="btn secondary" id="p-pagbank">Conectar PagBank</button></div><div class="status" id="p-status"></div>';
 $('p-din').checked=!!p.aceita_dinheiro;$('p-pixp').checked=!!p.aceita_pix_presencial;$('p-cart').checked=!!p.aceita_cartao_presencial;$('p-pixo').checked=!!p.aceita_pix_online;$('p-antec').checked=!!p.exige_pagamento_antecipado;$('p-sinal-t').value=p.sinal_tipo||'nenhum';$('p-sinal-v').value=Number(p.sinal_valor||0);
 const q=new URLSearchParams(location.search).get('pagbank');if(q==='conectado')$('p-status').textContent='PagBank conectado com sucesso.';else if(q==='erro')$('p-status').textContent='A conexão com PagBank não foi concluída.';
 $('p-save').onclick=async()=>{const st=$('p-status');try{st.textContent='Salvando…';const np=await apiFetch('/lojas/'+loja.id+'/cliente-hub/pagamentos',{method:'PUT',body:JSON.stringify({provedor:p.provedor||null,aceita_dinheiro:$('p-din').checked,aceita_pix_presencial:$('p-pixp').checked,aceita_cartao_presencial:$('p-cart').checked,aceita_pix_online:$('p-pixo').checked,exige_pagamento_antecipado:$('p-antec').checked,sinal_tipo:$('p-sinal-t').value,sinal_valor:Number($('p-sinal-v').value||0)})});resumo.pagamentos={...p,...np};st.textContent='Formas de pagamento salvas.';await recarregarProgresso();}catch(e){st.textContent=e.message||'Não foi possível salvar.';}};
 $('p-pagbank').onclick=async()=>{const st=$('p-status'),b=$('p-pagbank');try{b.disabled=true;st.textContent='Abrindo PagBank…';const x=await apiFetch('/pagamentos/pagbank/lojas/'+loja.id+'/iniciar',{method:'POST',body:'{}'});if(!x.url)throw new Error('Não foi possível abrir a autorização.');location.href=x.url;}catch(e){st.textContent=e.message||'Não foi possível iniciar a conexão.';b.disabled=false;}};
}
function renderAgenda(){
 const cfg=resumo.agenda_config||{},hs=cfg.horarios||{};const nomes=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
 $('content').innerHTML='<h2>Agenda de atendimento</h2><p class="muted">A IA só oferece horários que estiverem marcados como abertos aqui.</p><div class="days">'+nomes.map((n,i)=>'<div class="day" data-day="'+i+'"><label><input class="d-open" type="checkbox"> '+n+'</label><input class="d-ini" type="time"><input class="d-fim" type="time"></div>').join('')+'</div><div class="field"><label>Intervalo da grade (min)</label><input id="grade" type="number" min="5" max="240" value="'+Number(cfg.intervalo_grade_min||30)+'"></div><div class="checks"><label class="check"><input id="rem24" type="checkbox"> Lembrete 24h antes</label><label class="check"><input id="rem2" type="checkbox"> Lembrete cerca de 2h antes</label></div><div class="btns"><button class="btn" id="agenda-save">Salvar agenda</button></div><div class="status" id="agenda-status"></div>';
 document.querySelectorAll('.day').forEach(row=>{const x=hs[row.dataset.day]||{};row.querySelector('.d-open').checked=x.aberto===true;row.querySelector('.d-ini').value=x.inicio||'09:00';row.querySelector('.d-fim').value=x.fim||'18:00';});$('rem24').checked=cfg.lembrete_24h!==false;$('rem2').checked=cfg.lembrete_2h!==false;
 $('agenda-save').onclick=async()=>{const st=$('agenda-status');try{const horarios={};document.querySelectorAll('.day').forEach(row=>{horarios[row.dataset.day]={aberto:row.querySelector('.d-open').checked,inicio:row.querySelector('.d-ini').value,fim:row.querySelector('.d-fim').value};});st.textContent='Salvando…';const x=await apiFetch('/lojas/'+loja.id+'/cliente-hub/agenda-config',{method:'PUT',body:JSON.stringify({horarios,intervalo_grade_min:Number($('grade').value||30),lembrete_24h:$('rem24').checked,lembrete_2h:$('rem2').checked})});resumo.agenda_config=x;st.textContent='Agenda configurada.';await recarregarProgresso();}catch(e){st.textContent=e.message||'Não foi possível salvar.';}};
}
function renderOperacao(){
 const feito=(onboarding?.etapas||[]).find(e=>e.id==='operacao')?.concluida;
 $('content').innerHTML='<h2>WhatsApp e teste</h2><p class="muted">'+(feito?'O WhatsApp já aparece como conectado. Você pode abrir a tela para revisar ou testar.':'Conecte o número que a IA vai atender e faça um teste antes de começar a divulgar.')+'</p><div class="notice">Esta etapa abre a tela própria do WhatsApp. Ela não fica escondida abaixo desta configuração.</div><div class="btns"><button class="btn" id="wa-open">'+(feito?'Abrir WhatsApp':'Conectar WhatsApp')+'</button></div>';
 $('wa-open').onclick=()=>location.href='whatsapp.html';
}
async function refreshResumo(){resumo=await apiFetch('/lojas/'+loja.id+'/cliente-hub')}
async function recarregarProgresso(){onboarding=await apiFetch('/lojas/'+loja.id+'/cliente-hub/onboarding');renderTabs()}
$('voltar').onclick=()=>location.href='cliente-central.html';
carregar();
</script></body></html>`);

/* Onboarding da Home agora navega para outra tela, nunca para seção abaixo */
let h=read('public/cliente-central.html');
const oldFn=/function onboardingDestino\(destino\)\{[\s\S]*?\n\}/;
if(!oldFn.test(h))throw new Error('Função onboardingDestino não encontrada');
h=h.replace(oldFn,"function onboardingDestino(destino){location.href='cliente-configuracao.html?etapa='+encodeURIComponent(destino);}");
write('public/cliente-central.html',h);

/* Rota explícita sem cache para a tela de configuração */
let app=read('src/app.js');
if(!app.includes("'/cliente/cliente-configuracao.html'")){
  const anchor="app.get('/cliente/cliente-central.html'";
  const i=app.indexOf(anchor);
  if(i<0)throw new Error('Rota da central cliente não encontrada');
  const lineEnd=app.indexOf('\n',i);
  const route="app.get('/cliente/cliente-configuracao.html', (_req, res) => { res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate'); return res.sendFile(__saintsaiClientPath.join(__saintsaiClientDir, 'cliente-configuracao.html')); });\n";
  app=app.slice(0,lineEnd+1)+route+app.slice(lineEnd+1);
}
write('src/app.js',app);

cp.execFileSync(process.execPath,['--check','src/controllers/clienteHub.controller.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','src/app.js'],{stdio:'inherit'});
console.log('Configuração do cliente separada em abas/telas próprias.');


/* SAINTSAI_CLIENT_NAVIGATION_V2: every configuration entry uses its own page. */
let central=read('public/cliente-central.html');
central=central.replace('</style>', `
.app > .section[hidden]{display:none!important}
body[data-client-view="agenda"] .client-hero,
body[data-client-view="agenda"] .app > .cards{display:none!important}
</style>`);
const oldSwitch=/function trocar\(sec\)\{[^\n]*\}/;
if(!oldSwitch.test(central))throw new Error('Navegação original do cliente não encontrada');
central=central.replace(oldSwitch, `function trocar(sec){
  if(['servicos','pagamentos','ia','operacao'].includes(sec)){
    location.href='cliente-configuracao.html?etapa='+encodeURIComponent(sec);return;
  }
  location.href='cliente-central.html'+(sec==='agenda'?'?aba=agenda':'');
}`);
central=central.replace('</body>', `<script>
(function(){
  const view=new URLSearchParams(location.search).get('aba')==='agenda'?'agenda':'inicio';
  document.body.dataset.clientView=view;
  document.querySelectorAll('.app > .section').forEach(el=>{
    el.hidden=el.id!==view;
    el.classList.toggle('active',el.id===view);
  });
  document.querySelectorAll('[data-sec]').forEach(el=>{
    const id=el.dataset.sec;
    el.classList.toggle('on',id===view);
    if(el.classList.contains('module'))el.classList.toggle('active',id===view);
    // The appointment shortcut remains an operational screen, separate from setup.
    el.dataset.clientHref=id==='inicio'?'cliente-central.html':
      el.classList.contains('primary')&&id==='agenda'?'cliente-central.html?aba=agenda':
      'cliente-configuracao.html?etapa='+encodeURIComponent(id);
  });
  document.querySelectorAll('a[href="cliente-estoque.html?secao=agente"],button[onclick*="cliente-estoque.html?secao=agente"]').forEach(el=>{
    el.dataset.clientHref='cliente-configuracao.html?etapa=ia';
  });
  document.addEventListener('click',event=>{
    const link=event.target.closest('[data-client-href]');if(!link)return;
    event.preventDefault();event.stopImmediatePropagation();
    location.href=link.dataset.clientHref;
  },true);
})();
</script></body>`);
write('public/cliente-central.html',central);

let config=read('public/cliente-configuracao.html');
config=config.replace("nome:'Itens'", "nome:'Itens/Serviços'");
config=config.replace('<nav class="tabs" id="tabs">','<nav class="tabs" id="tabs" aria-label="Etapas de configuração">');
config=config.replace("$('voltar').onclick=()=>location.href='cliente-central.html';\ncarregar();", "$('voltar').onclick=()=>location.href='cliente-central.html';\nrenderTabs();\ncarregar();");
config=config.replace('<h2>Agenda de atendimento</h2>', '<h2>Agenda de atendimento</h2><a class="muted" href="cliente-central.html?aba=agenda">Ver agendamentos e reservar horário →</a>');
write('public/cliente-configuracao.html',config);

// The APK uses /painel, while the website uses /cliente. Both must avoid stale HTML.
let clientApp=read('src/app.js');
const cacheAnchor="app.use('/painel',";
if(!clientApp.includes('SAINTSAI_CLIENT_PAGES_NO_CACHE_V2')){
  const pos=clientApp.indexOf(cacheAnchor);
  if(pos<0)throw new Error('Montagem /painel não encontrada');
  const cacheRoutes=`
// SAINTSAI_CLIENT_PAGES_NO_CACHE_V2
app.get(['/painel/cliente-central.html','/painel/cliente-configuracao.html'],(req,res)=>{
  res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma','no-cache');res.set('Expires','0');
  const file=req.path.endsWith('cliente-configuracao.html')?'cliente-configuracao.html':'cliente-central.html';
  return res.sendFile(require('node:path').join(process.cwd(),'public',file));
});
`;
  clientApp=clientApp.slice(0,pos)+cacheRoutes+clientApp.slice(pos);
}
write('src/app.js',clientApp);
