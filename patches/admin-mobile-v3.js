const fs=require('node:fs');

function write(p,s){fs.writeFileSync(p,s);}
function read(p){return fs.readFileSync(p,'utf8');}

const html=\`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#090812"><title>Agente SaintsAI · Admin</title>
<link rel="stylesheet" href="css/styles.css"><script src="js/theme.js"></script><script src="js/guard.js"></script>
<style>
:root{--bg:#090812;--card:#12121c;--line:rgba(157,92,255,.24);--purple:#8b5cf6;--text:#f7f5ff;--muted:#aaa5b7;--ok:#22c55e;--warn:#f59e0b}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:radial-gradient(circle at 90% 0,#1b1232 0,#090812 34%,#07070c 100%);color:var(--text);font-family:Inter,Manrope,system-ui,sans-serif}
.app{min-height:100vh;padding:calc(12px + env(safe-area-inset-top)) 12px calc(34px + env(safe-area-inset-bottom));max-width:760px;margin:auto}
.top{display:flex;align-items:center;gap:12px;margin-bottom:14px}.menuBtn{width:46px;height:46px;border:1px solid var(--line);border-radius:14px;background:#12111d;color:white;font-size:24px}.top h1{margin:0;font-size:22px}.top p{margin:3px 0 0;color:var(--muted);font-size:13px}
.card{background:linear-gradient(180deg,rgba(24,24,37,.97),rgba(15,15,25,.97));border:1px solid var(--line);border-radius:19px;padding:15px;margin-bottom:12px}.card h2{margin:0 0 12px;font-size:18px}.sub,.note{color:var(--muted);font-size:13px}
.field{display:grid;gap:6px;margin:10px 0}.field label{font-size:13px;font-weight:800}.field input,.field textarea,.field select{width:100%;border:1px solid rgba(190,185,215,.2);background:#0c0c14;color:#fff;border-radius:12px;padding:12px 13px;font:inherit}.field textarea{min-height:125px;resize:vertical}
.grid2{display:grid;grid-template-columns:1fr;gap:10px}.btn{width:100%;border-radius:13px;padding:13px 14px;font-weight:900;font-size:14px;border:0}.primary{color:#fff;background:linear-gradient(135deg,#7c3aed,#9333ea)}.secondary{color:#eee8ff;background:#171523;border:1px solid rgba(180,175,210,.18)}.btn:disabled{opacity:.45}
.chips{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.chip{border:1px solid rgba(190,185,215,.18);background:#101019;color:#ddd8ee;border-radius:12px;padding:11px 8px;font-weight:800}.chip.active{background:linear-gradient(135deg,#7c3aed,#9333ea);border-color:#a78bfa;color:white}
.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.plan{border:1px solid rgba(190,185,215,.18);background:#101018;color:#fff;border-radius:13px;padding:10px 6px;text-align:center;font-size:12px}.plan.active{background:rgba(124,58,237,.25);border-color:#9f67ff}.plan strong{display:block;font-size:13px}.dur{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:10px}.dur .chip{font-size:11px;padding:10px 4px}
.status{font-size:12px;margin-top:10px;padding:10px 11px;border-radius:11px;background:rgba(245,158,11,.12);color:#fbbf24}.status.ok{background:rgba(34,197,94,.12);color:#4ade80}.hidden{display:none!important}
.drawerBg{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:90;display:none}.drawer{position:fixed;left:0;top:0;bottom:0;width:min(84vw,330px);z-index:91;background:linear-gradient(180deg,#151324,#0b0a12);border-right:1px solid var(--line);padding:calc(24px + env(safe-area-inset-top)) 16px 22px;transform:translateX(-105%);transition:.2s}.drawer.open{transform:translateX(0)}.drawerBg.open{display:block}.brand{display:flex;align-items:center;gap:11px;margin-bottom:24px}.bot{width:46px;height:46px;border-radius:16px;background:linear-gradient(135deg,#7c3aed,#a855f7);display:grid;place-items:center;font-size:23px}.brand h2{margin:0}.brand p{margin:3px 0 0;color:var(--muted);font-size:12px}
.nav{display:grid;gap:8px}.nav button{width:100%;text-align:left;padding:13px 14px;border:0;border-radius:13px;color:#eee8ff;font-weight:900;background:rgba(255,255,255,.025);font:inherit}.nav button.active{background:linear-gradient(135deg,rgba(124,58,237,.75),rgba(109,40,217,.75))}
.selector details{border:1px solid rgba(190,185,215,.16);background:#0f0f18;border-radius:14px;overflow:hidden}.selector summary{cursor:pointer;padding:14px;font-weight:900;list-style:none}.selector summary::-webkit-details-marker{display:none}.selector summary:after{content:'▾';float:right;color:#b99cff}.pick{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;border:0;border-top:1px solid rgba(190,185,215,.1);background:#101019;color:#fff;padding:13px;text-align:left}.pick small{display:block;color:var(--muted);margin-top:3px}.arrow{font-size:20px;color:#b99cff}
.passwordWrap{position:relative}.passwordWrap input{padding-right:80px}.showpass{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:#b8a7ff;font-weight:800}
.testMark{display:inline-block;padding:5px 9px;border-radius:999px;background:rgba(34,197,94,.12);color:#4ade80;font-size:11px;font-weight:900;margin-bottom:10px}
@media(min-width:720px){.grid2{grid-template-columns:1fr 1fr}.chips{grid-template-columns:repeat(4,1fr)}}
</style>
</head>
<body>
<div id="drawerBg" class="drawerBg"></div>
<aside id="drawer" class="drawer">
 <div class="brand"><div class="bot">🤖</div><div><h2>Agente SaintsAI</h2><p>Inteligência que vende</p></div></div>
 <nav class="nav">
  <button data-view="clientes">👥 MEUS CLIENTES</button>
  <button data-view="estoque">📦 ESTOQUE</button>
  <button data-view="registro" class="active">＋ REGISTRAR NOVO CLIENTE</button>
  <button data-view="teste">🧪 REGISTRO TESTE</button>
  <button data-view="assinaturas">♛ ASSINATURAS</button>
  <button id="configBtn">⚙ CONFIGURAÇÕES</button>
 </nav>
</aside>

<main class="app">
 <header class="top"><button id="menuBtn" class="menuBtn">☰</button><div><h1 id="pageTitle">Registrar novo cliente</h1><p id="pageSub">Crie e ative um novo cliente na SaintsAI</p></div></header>

 <section id="view-clientes" class="view hidden">
  <div class="card"><h2>Meus clientes</h2><p class="sub">Toque na seta e escolha qual cliente deseja configurar.</p><div class="selector"><details><summary>Selecionar cliente</summary><div id="clientesPick"></div></details></div></div>
 </section>

 <section id="view-estoque" class="view hidden">
  <div class="card"><h2>Estoque</h2><p class="sub">Selecione um cliente para abrir somente o estoque dele.</p><div class="selector"><details><summary>Selecionar cliente</summary><div id="estoquePick"></div></details></div></div>
 </section>

 <section id="view-registro" class="view">
  <div class="card">
   <h2>Dados do cliente</h2>
   <div class="field"><label>Nome da loja</label><input id="nome" placeholder="Ex: Minha Loja"></div>
   <div class="field"><label>E-mail fictício</label><input id="email" type="email" placeholder="Ex: loja@exemplo.com"></div>
   <div class="field"><label>Senha</label><div class="passwordWrap"><input id="senha" type="password" minlength="6" placeholder="Mínimo 6 caracteres"><button id="showpass" class="showpass" type="button">Mostrar</button></div></div>
   <button id="criar" class="btn primary" type="button">Criar cliente</button><div id="createStatus" class="status hidden"></div>
  </div>
  <div class="card"><h2>Prompt Mestre</h2><div class="field"><textarea id="prompt" placeholder="Escreva aqui o prompt mestre completo..."></textarea></div></div>
  <div class="card"><h2>Personalidade do agente</h2><div id="personas" class="chips"><button class="chip active" data-v="amigavel">☺ Amigável</button><button class="chip" data-v="profissional">▣ Profissional</button><button class="chip" data-v="direto">◎ Direto</button><button class="chip" data-v="casual">◯ Casual</button></div></div>
  <div class="card"><h2>Números de contato</h2><div class="grid2"><div class="field"><label>Número do agente</label><input id="agente" type="tel"></div><div class="field"><label>Número oficial do dono</label><input id="dono" type="tel"></div></div><div class="note">O número do dono recebe os lembretes de renovação.</div></div>
  <div class="card"><h2>Plano e duração</h2><div id="planos" class="plans"><div class="sub">Crie o cliente para carregar os planos.</div></div><div id="duracoes" class="dur"><button class="chip active" data-m="1">1 mês</button><button class="chip" data-m="3">3 meses</button><button class="chip" data-m="6">6 meses</button><button class="chip" data-m="12">12 meses</button></div></div>
  <div class="card"><h2>Pagamento</h2><div class="field"><label>Pix copia e cola</label><textarea id="pix" readonly placeholder="Clique em gerar o Pix"></textarea></div><button id="gerarPix" class="btn primary" disabled>Gerar Pix</button><div id="pixStatus" class="status">Crie o cliente para liberar o pagamento.</div></div>
  <div id="waCard" class="card"><h2>WhatsApp</h2><button id="whatsappBtn" class="btn secondary" disabled>Conectar WhatsApp após pagamento</button></div>
 </section>

 <section id="view-teste" class="view hidden">
  <div class="card">
   <span class="testMark">SEM PAGAMENTO · TESTE</span><h2>Registro Teste</h2><p class="sub">Cria um cliente de teste e libera o plano por 24 horas, sem Pix.</p>
   <div class="field"><label>Nome da loja</label><input id="tnome" placeholder="Ex: Loja Teste"></div>
   <div class="field"><label>E-mail fictício</label><input id="temail" type="email" placeholder="Ex: teste@saintsai.local"></div>
   <div class="field"><label>Senha</label><input id="tsenha" type="password" minlength="6" placeholder="Mínimo 6 caracteres"></div>
   <div class="field"><label>Prompt Mestre</label><textarea id="tprompt" placeholder="Prompt que será usado no teste"></textarea></div>
   <div class="grid2"><div class="field"><label>Número do agente</label><input id="tagente" type="tel"></div><div class="field"><label>Número oficial do dono</label><input id="tdono" type="tel"></div></div>
   <button id="criarTeste" class="btn primary">Criar teste e liberar WhatsApp</button><div id="testStatus" class="status hidden"></div>
  </div>
 </section>

 <section id="view-assinaturas" class="view hidden"><div class="card"><h2>Assinaturas</h2><p class="sub">Escolha um cliente em “Meus Clientes” para gerenciar o plano e a assinatura dele.</p><button class="btn secondary" data-go="clientes">Selecionar cliente</button></div></section>
</main>

<script src="js/config.js"></script><script src="js/auth.js"></script><script src="js/api.js"></script>
<script>
let lojaId=null,persona='amigavel',plano=null,meses=1,clientesCache=[];
const $=id=>document.getElementById(id),digits=v=>String(v||'').replace(/\\D/g,'');
const esc=s=>{const d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML;};

const titles={clientes:['Meus clientes','Selecione quem você deseja configurar'],estoque:['Estoque','Escolha o cliente e abra o estoque dele'],registro:['Registrar novo cliente','Crie e ative um novo cliente na SaintsAI'],teste:['Registro Teste','Teste sem pagamento'],assinaturas:['Assinaturas','Gerencie planos dos seus clientes']};
function showView(v){
 document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));$('view-'+v).classList.remove('hidden');
 document.querySelectorAll('.nav button[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===v));
 $('pageTitle').textContent=titles[v][0];$('pageSub').textContent=titles[v][1];location.hash=v;closeDrawer();
}
function openDrawer(){$('drawer').classList.add('open');$('drawerBg').classList.add('open')}function closeDrawer(){$('drawer').classList.remove('open');$('drawerBg').classList.remove('open')}
$('menuBtn').onclick=openDrawer;$('drawerBg').onclick=closeDrawer;document.querySelectorAll('.nav button[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go));$('configBtn').onclick=()=>location.href='configuracoes.html';
$('showpass').onclick=()=>{const i=$('senha'),v=i.type==='text';i.type=v?'password':'text';$('showpass').textContent=v?'Mostrar':'Ocultar'};

document.querySelectorAll('#personas .chip').forEach(b=>b.onclick=()=>{persona=b.dataset.v;document.querySelectorAll('#personas .chip').forEach(x=>x.classList.toggle('active',x===b))});
document.querySelectorAll('#duracoes .chip').forEach(b=>b.onclick=()=>{meses=Number(b.dataset.m);document.querySelectorAll('#duracoes .chip').forEach(x=>x.classList.toggle('active',x===b))});

function chooseStore(c){
 try{localStorage.setItem('lojaia_loja_atual_id',c.loja_id);sessionStorage.setItem('lojaia_loja_atual',JSON.stringify({id:c.loja_id,nome:c.nome}));}catch(_){}
}
function renderPicks(){
 const empty='<div class="pick"><span>Nenhum cliente cadastrado</span></div>';
 $('clientesPick').innerHTML=clientesCache.length?clientesCache.map(c=>'<button class="pick" data-config="'+c.loja_id+'"><span><strong>'+esc(c.nome)+'</strong><small>'+esc(c.email||c.username||'')+'</small></span><span class="arrow">›</span></button>').join(''):empty;
 $('estoquePick').innerHTML=clientesCache.length?clientesCache.map(c=>'<button class="pick" data-stock="'+c.loja_id+'"><span><strong>'+esc(c.nome)+'</strong><small>Abrir estoque deste cliente</small></span><span class="arrow">›</span></button>').join(''):empty;
 document.querySelectorAll('[data-config]').forEach(b=>b.onclick=()=>location.href='admin-cliente.html?loja='+encodeURIComponent(b.dataset.config));
 document.querySelectorAll('[data-stock]').forEach(b=>b.onclick=()=>{const c=clientesCache.find(x=>x.loja_id===b.dataset.stock);if(c)chooseStore(c);location.href='admin-estoque.html?loja='+encodeURIComponent(b.dataset.stock)});
}
async function loadClients(){try{const xs=await apiFetch('/admin/clientes-gerenciados');clientesCache=Array.isArray(xs)?xs:[];renderPicks()}catch(e){if(e instanceof SessaoExpiradaError)return fazerLogout();clientesCache=[];renderPicks()}}
async function loadPlans(){const x=await apiFetch('/admin/lojas/'+encodeURIComponent(lojaId)+'/assinatura');const ps=(x&&x.planosDisponiveis)||[];$('planos').innerHTML=ps.filter(p=>p.vendavel!==false).map((p,i)=>'<button class="plan '+(i===0?'active':'')+'" data-p="'+esc(p.codigo)+'"><strong>'+esc(p.nome)+'</strong><span>'+((Number(p.precoMensalCentavos||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}))+'/mês</span></button>').join('');const bs=[...document.querySelectorAll('#planos .plan')];if(bs[0])plano=bs[0].dataset.p;bs.forEach(b=>b.onclick=()=>{plano=b.dataset.p;bs.forEach(x=>x.classList.toggle('active',x===b))})}

$('criar').onclick=async()=>{if(lojaId){$('createStatus').className='status ok';$('createStatus').textContent='Cliente já criado. Continue abaixo.';return}const nome=$('nome').value.trim(),email=$('email').value.trim().toLowerCase(),senha=$('senha').value;$('createStatus').className='status';$('createStatus').classList.remove('hidden');if(nome.length<2||!email||senha.length<6)return $('createStatus').textContent='Preencha nome, e-mail e senha.';const b=$('criar');b.disabled=true;try{const r=await apiFetch('/admin/clientes',{method:'POST',body:JSON.stringify({nome,email,senha})});lojaId=r?.loja?.id;if(!lojaId)throw new Error('Loja não criada.');$('createStatus').className='status ok';$('createStatus').textContent='Cliente criado. Continue a configuração.';$('gerarPix').disabled=false;await loadPlans();await loadClients()}catch(e){$('createStatus').textContent=e.message||'Não foi possível criar.'}finally{b.disabled=false}};

async function saveConfig(){const nome=$('nome').value.trim(),prompt=$('prompt').value.trim(),agente=digits($('agente').value),dono=digits($('dono').value);if(!lojaId)throw new Error('Crie o cliente primeiro.');if(!prompt)throw new Error('Preencha o Prompt Mestre.');if(agente.length<10||dono.length<10)throw new Error('Preencha os dois números com DDD.');await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId),{method:'PUT',body:JSON.stringify({nome,prompt_mestre:prompt,numero_whatsapp:''})});await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId)+'/personalidade',{method:'PUT',body:JSON.stringify({personalidade:persona})});await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId)+'/contatos',{method:'PUT',body:JSON.stringify({numero_whatsapp:agente,numero_dono_whatsapp:dono})})}
$('gerarPix').onclick=async()=>{const b=$('gerarPix');b.disabled=true;$('pixStatus').className='status';$('pixStatus').textContent='Salvando e gerando Pix…';try{if(!plano)throw new Error('Escolha um plano.');await saveConfig();const x=await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId)+'/pix',{method:'POST',body:JSON.stringify({plano,duracao_meses:meses})});$('pix').value=x.pix_copia_cola||'';$('pixStatus').textContent='Pix gerado. Aguardando confirmação.';pollPayment()}catch(e){$('pixStatus').textContent=e.message||'Não foi possível gerar o Pix.'}finally{b.disabled=false}};
async function pollPayment(){if(!lojaId)return;try{const x=await apiFetch('/admin/lojas/'+encodeURIComponent(lojaId)+'/assinatura');if(x?.situacao?.ativo){$('pixStatus').className='status ok';$('pixStatus').textContent='Pagamento confirmado.';$('whatsappBtn').disabled=false;$('whatsappBtn').textContent='Conectar WhatsApp'}else setTimeout(pollPayment,5000)}catch(_){}}
$('whatsappBtn').onclick=()=>{if(lojaId)location.href='admin-cliente-whatsapp.html?loja='+encodeURIComponent(lojaId)};

$('criarTeste').onclick=async()=>{const st=$('testStatus'),b=$('criarTeste');st.className='status';st.classList.remove('hidden');const nome=$('tnome').value.trim(),email=$('temail').value.trim().toLowerCase(),senha=$('tsenha').value,prompt=$('tprompt').value.trim(),agente=digits($('tagente').value),dono=digits($('tdono').value);if(nome.length<2||!email||senha.length<6||!prompt||agente.length<10||dono.length<10){st.textContent='Preencha todos os dados do teste.';return}b.disabled=true;st.textContent='Criando registro teste…';try{const r=await apiFetch('/admin/clientes',{method:'POST',body:JSON.stringify({nome,email,senha})});const id=r?.loja?.id;if(!id)throw new Error('Loja de teste não criada.');await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({nome,prompt_mestre:prompt,numero_whatsapp:''})});await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(id)+'/personalidade',{method:'PUT',body:JSON.stringify({personalidade:'amigavel'})});await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(id)+'/contatos',{method:'PUT',body:JSON.stringify({numero_whatsapp:agente,numero_dono_whatsapp:dono})});const d=new Date();d.setHours(d.getHours()+24);await apiFetch('/admin/lojas/'+encodeURIComponent(id)+'/assinatura',{method:'PUT',body:JSON.stringify({plano:'trial',status:'ativo',valido_ate:d.toISOString()})});st.className='status ok';st.textContent='Teste liberado por 24 horas. Abrindo WhatsApp…';await loadClients();setTimeout(()=>location.href='admin-cliente-whatsapp.html?loja='+encodeURIComponent(id),500)}catch(e){if(e instanceof SessaoExpiradaError)return fazerLogout();st.textContent=e.message||'Não foi possível criar o teste.'}finally{b.disabled=false}};

loadClients();const initial=(location.hash||'#registro').slice(1);showView(titles[initial]?initial:'registro');
</script>
</body></html>\`;

write('public/admin-mobile.html',html);

// Qualquer rota antiga do Admin agora cai sempre no novo painel.
write('public/admin.html',\`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=admin-mobile.html"><script>location.replace('admin-mobile.html'+(location.hash||''))</script><title>SaintsAI Admin</title></head><body></body></html>\`);

// Estoque administrativo do cliente escolhido: mantém retorno para o painel novo.
const estoque=\`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#090812"><title>Estoque do cliente · SaintsAI</title><style>html,body{margin:0;background:#090812;color:#fff;font-family:system-ui,sans-serif}.bar{height:58px;display:flex;align-items:center;gap:12px;padding:0 14px;border-bottom:1px solid rgba(157,92,255,.25);background:#0d0c15}.bar a{color:#fff;text-decoration:none;font-weight:800}.bar strong{font-size:16px}iframe{width:100%;height:calc(100vh - 58px);border:0;background:#090812}</style></head><body><div class="bar"><a href="admin-mobile.html#estoque">← Voltar</a><strong>Estoque do cliente</strong></div><iframe id="f" title="Estoque"></iframe><script>const id=new URLSearchParams(location.search).get('loja');if(!id){location.replace('admin-mobile.html#estoque')}else{try{localStorage.setItem('lojaia_loja_atual_id',id);sessionStorage.setItem('lojaia_loja_atual',JSON.stringify({id:id}))}catch(_){}document.getElementById('f').src='estoque.html';document.getElementById('f').addEventListener('load',function(){try{const d=this.contentDocument,s=d.createElement('style');s.textContent='#sidebar-container,#topbar-container,#tabbar-container{display:none!important}.app-shell{display:block!important}.main-col{display:block!important}.page{padding:16px!important;padding-bottom:40px!important}';d.head.appendChild(s)}catch(_){}})}</script></body></html>\`;
write('public/admin-estoque.html',estoque);

// Links de retorno conhecidos deixam de apontar ao Admin antigo.
for(const p of ['public/admin-cliente.html','public/admin-cliente-plano.html','public/admin-cliente-whatsapp.html','public/admin-cliente-concluido.html']){
 if(!fs.existsSync(p))continue;let s=read(p);s=s.replaceAll('href="admin.html"','href="admin-mobile.html#clientes"').replaceAll("window.location.href='admin.html'","window.location.href='admin-mobile.html#clientes'");write(p,s);
}

console.log('Admin mobile v3: abas separadas, Registro Teste e seletor de cliente/estoque aplicados.');
