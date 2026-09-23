const fs=require('node:fs');

function read(p){return fs.readFileSync(p,'utf8');}
function write(p,s){fs.writeFileSync(p,s);}

// Corrige leitura do cliente gerenciado para usar apenas colunas garantidas.
let c=read('src/controllers/admin.controller.js');
c=c.replace(
".select('id, nome, dono_id, ativa, prompt_mestre, agente_personalidade, agente_aviso, agente_aviso_ativo')",
".select('id, nome, dono_id, ativa, prompt_mestre')"
);
write('src/controllers/admin.controller.js',c);

// Após criar o cliente, abre diretamente o fluxo guiado desse cliente.
let a=read('public/js/admin.js');
a=a.replace(
"resultado.textContent = 'Cliente criado: ' + dados.cliente.email + '. Já pode entrar sem confirmar e-mail.';",
"resultado.textContent = 'Cliente criado. Abrindo configuração da IA…';"
);
a=a.replace(
"document.getElementById('admin-cliente-form').reset();\n    paginaAdmin = 1;",
"document.getElementById('admin-cliente-form').reset();\n    if (dados && dados.loja && dados.loja.id) { window.location.href = 'admin-cliente.html?loja=' + encodeURIComponent(dados.loja.id); return; }\n    paginaAdmin = 1;"
);
write('public/js/admin.js',a);

// Tela guiada do cliente — Etapa 1 IA.
const html=`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover">
<meta name="theme-color" content="#08070d">
<title>Configurar cliente · SaintsAI</title>
<link rel="stylesheet" href="css/styles.css">
<script src="js/theme.js"></script>
<script src="js/guard.js"></script>
<style>
.client-flow{max-width:760px;margin:0 auto;padding:18px 14px 110px}
.flow-head{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.flow-title{margin:0;font-size:24px}.flow-sub{margin:4px 0 0;opacity:.72;font-size:13px}
.flow-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:14px 0 20px}
.flow-step{padding:10px 7px;border-radius:14px;text-align:center;background:rgba(127,127,127,.08);font-size:12px;font-weight:700;opacity:.58}
.flow-step.active{opacity:1;border:1px solid rgba(151,91,255,.55);background:rgba(151,91,255,.13)}
.flow-step.done{opacity:1}
.flow-card{background:var(--surface,#111018);border:1px solid rgba(150,90,240,.24);border-radius:20px;padding:17px;margin-bottom:14px}
.flow-card h2{margin:0 0 6px}.flow-card p{margin-top:0;opacity:.75}
.flow-grid{display:grid;gap:14px}.flow-grid label{display:grid;gap:7px;font-weight:700}
.flow-grid input,.flow-grid textarea{width:100%;box-sizing:border-box}.flow-grid textarea{min-height:290px;resize:vertical}
.flow-actions{position:fixed;left:0;right:0;bottom:0;padding:12px 14px calc(12px + env(safe-area-inset-bottom));background:rgba(9,8,14,.94);backdrop-filter:blur(14px);border-top:1px solid rgba(127,127,127,.18);z-index:20}
.flow-actions-inner{max-width:760px;margin:0 auto;display:flex;gap:10px}.flow-actions button{flex:1}
.flow-status{font-size:13px;min-height:20px;margin-top:10px}
@media(max-width:480px){.flow-step{font-size:11px;padding:9px 3px}.flow-card{padding:15px}.flow-grid textarea{min-height:320px}}
</style>
</head>
<body>
<main class="client-flow">
  <div class="flow-head">
    <a href="admin.html" class="btn-secondary small" style="text-decoration:none">← Clientes</a>
    <div><h1 class="flow-title" id="cliente-titulo">Configurar cliente</h1><p class="flow-sub" id="cliente-login"></p></div>
  </div>

  <div class="flow-steps" aria-label="Etapas">
    <div class="flow-step active" id="etapa-ia">1. IA</div>
    <div class="flow-step" id="etapa-plano">2. Plano</div>
    <div class="flow-step" id="etapa-wa">3. WhatsApp</div>
    <div class="flow-step" id="etapa-ok">Concluído</div>
  </div>

  <div id="cliente-erro" class="error-msg hidden" role="alert"></div>

  <section class="flow-card">
    <h2>1. Configure a IA</h2>
    <p>Defina primeiro o comportamento do agente. O plano e o WhatsApp vêm depois.</p>
    <div class="flow-grid">
      <label>Nome da loja
        <input id="cliente-nome" type="text" maxlength="100" autocomplete="organization">
      </label>
      <label>Prompt Mestre
        <textarea id="cliente-prompt" maxlength="12000" placeholder="Cole aqui as regras, personalidade, produtos, horários e orientações do atendimento."></textarea>
      </label>
    </div>
    <div class="flow-status" id="cliente-status" role="status"></div>
  </section>

  <section class="flow-card" style="opacity:.62">
    <h2>Próxima etapa: Plano</h2>
    <p>Depois de salvar a IA, você seguirá para plano, pagamento e ativação.</p>
  </section>
</main>

<div class="flow-actions">
  <div class="flow-actions-inner">
    <button id="cliente-salvar" class="btn-primary" type="button">Salvar IA e continuar</button>
  </div>
</div>

<script src="js/config.js"></script>
<script src="js/auth.js"></script>
<script src="js/api.js"></script>
<script>
const lojaId=new URLSearchParams(location.search).get('loja');
let clienteDados=null;
function mostrarErro(msg){const box=document.getElementById('cliente-erro');box.textContent=msg;box.classList.remove('hidden');}
async function carregar(){
 if(!lojaId)return mostrarErro('Cliente inválido.');
 try{
  clienteDados=await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId));
  document.getElementById('cliente-titulo').textContent=clienteDados.nome||'Cliente';
  document.getElementById('cliente-login').textContent=clienteDados.email||clienteDados.username||'';
  document.getElementById('cliente-nome').value=clienteDados.nome||'';
  document.getElementById('cliente-prompt').value=String(clienteDados.prompt_mestre||'').replace(/\\n*\\[SAINTSAI_CONFIG_CLIENTE\\][\\s\\S]*?\\[\\/SAINTSAI_CONFIG_CLIENTE\\]\\n*/g,'\\n').trim();
  if(document.getElementById('cliente-prompt').value.trim()) document.getElementById('etapa-ia').classList.add('done');
 }catch(e){if(e instanceof SessaoExpiradaError)return fazerLogout();mostrarErro(e.message||'Não foi possível carregar o cliente.');}
}
document.getElementById('cliente-salvar').addEventListener('click',async()=>{
 const status=document.getElementById('cliente-status');
 const nome=document.getElementById('cliente-nome').value.trim();
 const prompt=document.getElementById('cliente-prompt').value.trim();
 if(nome.length<2){status.textContent='Informe o nome da loja.';return;}
 if(!prompt){status.textContent='Cole a Prompt Mestre antes de continuar.';return;}
 const btn=document.getElementById('cliente-salvar');btn.disabled=true;status.textContent='Salvando IA…';
 try{
  await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId),{method:'PUT',body:JSON.stringify({nome,prompt_mestre:prompt,numero_whatsapp:''})});
  document.getElementById('etapa-ia').classList.add('done');
  status.textContent='IA salva. Etapa 1 concluída.';
  setTimeout(()=>{window.location.href='admin-cliente-plano.html?loja='+encodeURIComponent(lojaId);},500);
 }catch(e){if(e instanceof SessaoExpiradaError)return fazerLogout();status.textContent=e.message||'Não foi possível salvar a IA.';}
 finally{btn.disabled=false;}
});
carregar();
</script>
</body>
</html>`;
write('public/admin-cliente.html',html);

console.log('Etapa 1 do onboarding Admin aplicada: criação -> IA guiada.');
