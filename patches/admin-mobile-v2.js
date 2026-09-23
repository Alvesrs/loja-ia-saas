const fs=require('node:fs');

const html=\`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#090812">
<title>Agente SaintsAI · Admin</title>
<link rel="stylesheet" href="css/styles.css">
<script src="js/theme.js"></script>
<script src="js/guard.js"></script>
<style>
:root{--bg:#090812;--panel:#11111a;--panel2:#151522;--line:rgba(157,92,255,.24);--purple:#8b5cf6;--purple2:#6d28d9;--text:#f7f5ff;--muted:#9e9aaf;--ok:#22c55e;--warn:#f59e0b;--bad:#ef4444}
*{box-sizing:border-box}html,body{margin:0;background:radial-gradient(circle at 90% 0,#1c1234 0,#090812 33%,#07070c 100%);color:var(--text);font-family:Inter,Manrope,system-ui,sans-serif}
body{min-height:100vh}.app{min-height:100vh;padding:calc(12px + env(safe-area-inset-top)) 12px calc(30px + env(safe-area-inset-bottom))}
.top{display:flex;align-items:center;gap:12px;margin-bottom:14px}.menu{width:46px;height:46px;border:1px solid var(--line);border-radius:14px;background:#12111d;color:#fff;font-size:24px}.top h1{margin:0;font-size:22px}.top p{margin:3px 0 0;color:var(--muted);font-size:13px}
.card{background:linear-gradient(180deg,rgba(23,23,36,.96),rgba(15,15,25,.96));border:1px solid var(--line);border-radius:19px;padding:15px;margin-bottom:12px;box-shadow:0 10px 28px rgba(0,0,0,.18)}
.card h2{font-size:18px;margin:0 0 12px}.sub{color:var(--muted);font-size:13px;margin-top:-5px;margin-bottom:12px}
.field{display:grid;gap:6px;margin:10px 0}.field label{font-size:13px;font-weight:700}.field input,.field textarea,.field select{width:100%;border:1px solid rgba(180,175,210,.2);background:#0d0d16;color:#fff;border-radius:12px;padding:12px 13px;font:inherit;outline:none}.field textarea{min-height:130px;resize:vertical}.field input:focus,.field textarea:focus,.field select:focus{border-color:#8b5cf6;box-shadow:0 0 0 3px rgba(139,92,246,.12)}
.grid2{display:grid;grid-template-columns:1fr;gap:10px}.chips{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.chip{border:1px solid rgba(180,175,210,.2);background:#11111b;color:#ddd8ee;border-radius:12px;padding:11px 8px;font-weight:800}.chip.active{background:linear-gradient(135deg,#7c3aed,#9333ea);border-color:#a78bfa;color:white}
.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.plan{border:1px solid rgba(180,175,210,.2);border-radius:13px;padding:11px 8px;background:#101018;color:#fff;text-align:center;font-size:12px}.plan.active{border-color:#9f67ff;background:rgba(124,58,237,.25)}.plan strong{display:block;font-size:13px}.dur{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:10px}.dur button{font-size:11px;padding:10px 4px}
.btn{width:100%;border:0;border-radius:13px;padding:13px 14px;font-weight:900;font-size:14px}.primary{color:white;background:linear-gradient(135deg,#7c3aed,#9333ea)}.secondary{color:#e9e4ff;background:#171523;border:1px solid rgba(180,175,210,.18)}.locked{opacity:.5}.btn:disabled{opacity:.45}
.status{font-size:12px;margin-top:10px;padding:10px 11px;border-radius:11px;background:rgba(245,158,11,.12);color:#fbbf24}.status.ok{background:rgba(34,197,94,.12);color:#4ade80}.hidden{display:none!important}
.clients{display:grid;gap:8px}.client{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 11px;border:1px solid rgba(180,175,210,.12);background:#0f0f18;border-radius:12px;text-decoration:none;color:inherit}.client small{color:var(--muted)}.badge{font-size:11px;border-radius:999px;padding:6px 8px;background:rgba(139,92,246,.16);color:#c4b5fd}
.drawerBg{position:fixed;inset:0;background:rgba(0,0,0,.58);z-index:90;display:none}.drawer{position:fixed;left:0;top:0;bottom:0;width:min(82vw,320px);z-index:91;background:linear-gradient(180deg,#151324,#0b0a12);border-right:1px solid var(--line);padding:calc(24px + env(safe-area-inset-top)) 16px 22px;transform:translateX(-105%);transition:.2s}.drawer.open{transform:translateX(0)}.drawerBg.open{display:block}.brand{display:flex;align-items:center;gap:11px;margin-bottom:26px}.bot{width:46px;height:46px;border-radius:16px;background:linear-gradient(135deg,#7c3aed,#a855f7);display:grid;place-items:center;font-size:23px}.brand h2{margin:0}.brand p{margin:3px 0 0;color:var(--muted);font-size:12px}.nav{display:grid;gap:8px}.nav a{padding:13px 14px;border-radius:13px;text-decoration:none;color:#eee8ff;font-weight:800;background:rgba(255,255,255,.025)}.nav a.active{background:linear-gradient(135deg,rgba(124,58,237,.7),rgba(109,40,217,.7))}
.passwordWrap{position:relative}.passwordWrap input{padding-right:82px}.showpass{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:#b8a7ff;font-weight:800}
.pixbox{margin-top:10px}.pixbox textarea{min-height:90px}.note{font-size:12px;color:var(--muted);margin-top:8px}
@media(min-width:720px){.app{max-width:760px;margin:auto}.grid2{grid-template-columns:1fr 1fr}.chips{grid-template-columns:repeat(4,1fr)}}
</style>
</head>
<body>
<div id="drawerBg" class="drawerBg"></div>
<aside id="drawer" class="drawer">
  <div class="brand"><div class="bot">🤖</div><div><h2>Agente SaintsAI</h2><p>Inteligência que vende</p></div></div>
  <nav class="nav">
    <a href="#meus-clientes">👥 MEUS CLIENTES</a>
    <a href="#novo" class="active">＋ REGISTRAR NOVO CLIENTE</a>
    <a href="#plano">♛ ASSINATURAS</a>
    <a href="configuracoes.html">⚙ CONFIGURAÇÕES</a>
  </nav>
</aside>

<main class="app">
  <header class="top">
    <button id="menuBtn" class="menu" type="button">☰</button>
    <div><h1>Registrar novo cliente</h1><p>Crie e ative um novo cliente na SaintsAI</p></div>
  </header>

  <section id="meus-clientes" class="card">
    <h2>Meus clientes</h2>
    <div id="clientes" class="clients"><div class="sub">Carregando clientes…</div></div>
  </section>

  <section id="novo" class="card">
    <h2>Dados do cliente</h2>
    <div class="field"><label>Nome da loja</label><input id="nome" placeholder="Ex: Minha Loja"></div>
    <div class="field"><label>E-mail fictício</label><input id="email" type="email" placeholder="Ex: loja@exemplo.com"></div>
    <div class="field"><label>Senha</label><div class="passwordWrap"><input id="senha" type="password" minlength="6" placeholder="Mínimo 6 caracteres"><button id="showpass" class="showpass" type="button">Mostrar</button></div></div>
    <button id="criar" class="btn primary" type="button">Criar cliente e liberar configuração</button>
    <div id="createStatus" class="status hidden"></div>
  </section>

  <section class="card">
    <h2>Prompt Mestre</h2>
    <div class="field"><textarea id="prompt" placeholder="Escreva aqui o prompt mestre completo..."></textarea></div>
    <div class="note">Aqui você define todo o comportamento e as instruções do agente.</div>
  </section>

  <section class="card">
    <h2>Personalidade do agente</h2>
    <div id="personas" class="chips">
      <button class="chip active" data-v="amigavel">☺ Amigável</button>
      <button class="chip" data-v="profissional">▣ Profissional</button>
      <button class="chip" data-v="direto">◎ Direto</button>
      <button class="chip" data-v="casual">◯ Casual</button>
    </div>
  </section>

  <section class="card">
    <h2>Números de contato</h2>
    <div class="grid2">
      <div class="field"><label>Número do agente</label><input id="agente" type="tel" placeholder="Ex: (11) 91111-1111"></div>
      <div class="field"><label>Número oficial do dono</label><input id="dono" type="tel" placeholder="Ex: (11) 92222-2222"></div>
    </div>
    <div class="note">O número do dono recebe os lembretes de renovação.</div>
  </section>

  <section id="plano" class="card">
    <h2>Plano e duração</h2>
    <div id="planos" class="plans"><div class="sub">Crie o cliente para carregar os planos.</div></div>
    <div id="duracoes" class="dur">
      <button class="chip active" data-m="1">1 mês</button>
      <button class="chip" data-m="3">3 meses</button>
      <button class="chip" data-m="6">6 meses</button>
      <button class="chip" data-m="12">12 meses</button>
    </div>
  </section>

  <section class="card">
    <h2>Pagamento</h2>
    <div class="field"><label>Pix copia e cola</label><textarea id="pix" readonly placeholder="Clique em gerar o Pix"></textarea></div>
    <button id="gerarPix" class="btn primary" type="button" disabled>Gerar Pix</button>
    <div id="pixStatus" class="status">Crie o cliente para liberar o pagamento.</div>
  </section>

  <section class="card locked" id="waCard">
    <h2>🔒 Conexão do WhatsApp</h2>
    <p class="sub">A conexão é liberada depois que o pagamento for confirmado.</p>
    <button id="whatsappBtn" class="btn secondary" disabled>Conectar WhatsApp</button>
  </section>
</main>

<script src="js/config.js"></script>
<script src="js/auth.js"></script>
<script src="js/api.js"></script>
<script>
let lojaId=null,persona='amigavel',plano=null,meses=1;
const $=id=>document.getElementById(id);
const digits=v=>String(v||'').replace(/\\D/g,'');
const esc=s=>{const d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML;};

function openDrawer(){ $('drawer').classList.add('open'); $('drawerBg').classList.add('open'); }
function closeDrawer(){ $('drawer').classList.remove('open'); $('drawerBg').classList.remove('open'); }
$('menuBtn').onclick=openDrawer;$('drawerBg').onclick=closeDrawer;
document.querySelectorAll('.nav a').forEach(a=>a.onclick=closeDrawer);

$('showpass').onclick=()=>{const i=$('senha');const v=i.type==='text';i.type=v?'password':'text';$('showpass').textContent=v?'Mostrar':'Ocultar';};

document.querySelectorAll('#personas .chip').forEach(b=>b.onclick=()=>{persona=b.dataset.v;document.querySelectorAll('#personas .chip').forEach(x=>x.classList.toggle('active',x===b));});
document.querySelectorAll('#duracoes .chip').forEach(b=>b.onclick=()=>{meses=Number(b.dataset.m);document.querySelectorAll('#duracoes .chip').forEach(x=>x.classList.toggle('active',x===b));});

async function loadClients(){
 try{
  const xs=await apiFetch('/admin/clientes-gerenciados');
  $('clientes').innerHTML=Array.isArray(xs)&&xs.length?xs.slice(0,5).map(c=>'<a class="client" href="admin-cliente.html?loja='+encodeURIComponent(c.loja_id)+'"><div><strong>'+esc(c.nome)+'</strong><br><small>'+esc(c.email||c.username||'')+'</small></div><span class="badge">'+(c.ativa?'Ativo':'Inativo')+'</span></a>').join(''):'<div class="sub">Nenhum cliente cadastrado ainda.</div>';
 }catch(e){if(e instanceof SessaoExpiradaError)return fazerLogout();$('clientes').innerHTML='<div class="sub">Não foi possível carregar os clientes.</div>';}
}

async function loadPlans(){
 const x=await apiFetch('/admin/lojas/'+encodeURIComponent(lojaId)+'/assinatura');
 const ps=(x&&x.planosDisponiveis)||[];
 $('planos').innerHTML=ps.filter(p=>p.vendavel!==false).map((p,i)=>'<button class="plan '+(i===0?'active':'')+'" data-p="'+esc(p.codigo)+'"><strong>'+esc(p.nome)+'</strong><span>'+((Number(p.precoMensalCentavos||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}))+'/mês</span></button>').join('')||'<div class="sub">Nenhum plano disponível.</div>';
 const btns=[...document.querySelectorAll('#planos .plan')]; if(btns[0]) plano=btns[0].dataset.p;
 btns.forEach(b=>b.onclick=()=>{plano=b.dataset.p;btns.forEach(x=>x.classList.toggle('active',x===b));});
}

$('criar').onclick=async()=>{
 if(lojaId){$('createStatus').className='status ok';$('createStatus').textContent='Cliente já criado. Continue configurando abaixo.';return;}
 const nome=$('nome').value.trim(),email=$('email').value.trim().toLowerCase(),senha=$('senha').value;
 $('createStatus').className='status';$('createStatus').classList.remove('hidden');
 if(nome.length<2||!email||senha.length<6){$('createStatus').textContent='Preencha nome, e-mail e senha com pelo menos 6 caracteres.';return;}
 const b=$('criar');b.disabled=true;$('createStatus').textContent='Criando cliente…';
 try{
  const r=await apiFetch('/admin/clientes',{method:'POST',body:JSON.stringify({nome,email,senha})});
  lojaId=r?.loja?.id;if(!lojaId)throw new Error('Cliente criado sem loja vinculada.');
  $('createStatus').className='status ok';$('createStatus').textContent='Cliente criado. Complete a configuração abaixo.';
  $('gerarPix').disabled=false;
  await loadPlans();await loadClients();
 }catch(e){if(e instanceof SessaoExpiradaError)return fazerLogout();$('createStatus').textContent=e.message||'Não foi possível criar o cliente.';}
 finally{b.disabled=false;}
};

async function saveConfig(){
 const nome=$('nome').value.trim(),prompt=$('prompt').value.trim(),agente=digits($('agente').value),dono=digits($('dono').value);
 if(!lojaId)throw new Error('Crie o cliente primeiro.');
 if(!prompt)throw new Error('Preencha o Prompt Mestre.');
 if(agente.length<10||dono.length<10)throw new Error('Preencha os dois números com DDD.');
 await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId),{method:'PUT',body:JSON.stringify({nome,prompt_mestre:prompt,numero_whatsapp:''})});
 await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId)+'/personalidade',{method:'PUT',body:JSON.stringify({personalidade:persona})});
 await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId)+'/contatos',{method:'PUT',body:JSON.stringify({numero_whatsapp:agente,numero_dono_whatsapp:dono})});
}

$('gerarPix').onclick=async()=>{
 const b=$('gerarPix');b.disabled=true;$('pixStatus').className='status';$('pixStatus').textContent='Salvando configuração e gerando Pix…';
 try{
  if(!plano)throw new Error('Escolha um plano.');
  await saveConfig();
  const x=await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId)+'/pix',{method:'POST',body:JSON.stringify({plano,duracao_meses:meses})});
  if(!x.pix_copia_cola)throw new Error('Código Pix não recebido.');
  $('pix').value=x.pix_copia_cola;$('pixStatus').textContent='Pix gerado. Aguardando confirmação do pagamento.';
  pollPayment();
 }catch(e){if(e instanceof SessaoExpiradaError)return fazerLogout();$('pixStatus').textContent=e.message||'Não foi possível gerar o Pix.';}
 finally{b.disabled=false;}
};

async function pollPayment(){
 if(!lojaId)return;
 try{
  const x=await apiFetch('/admin/lojas/'+encodeURIComponent(lojaId)+'/assinatura');
  if(x?.situacao?.ativo){
   $('pixStatus').className='status ok';$('pixStatus').textContent='Pagamento confirmado. Plano ativado.';
   $('waCard').classList.remove('locked');$('whatsappBtn').disabled=false;
  }else setTimeout(pollPayment,5000);
 }catch(_){}
}
$('whatsappBtn').onclick=()=>{if(lojaId)location.href='admin-cliente-whatsapp.html?loja='+encodeURIComponent(lojaId);};

loadClients();
</script>
</body></html>\`;

fs.writeFileSync('public/admin-mobile.html',html);

let login=fs.readFileSync('public/login.html','utf8');
login=login.replace(
  "const destinoPermitido = ['dashboard.html', 'whatsapp.html', 'admin.html'];",
  "const destinoPermitido = ['dashboard.html', 'whatsapp.html', 'admin.html', 'admin-mobile.html'];"
);
fs.writeFileSync('public/login.html',login);

console.log('Painel Admin mobile v2 criado e liberado no login.');
