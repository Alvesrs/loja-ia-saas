const fs=require('node:fs');
function write(p,s){fs.writeFileSync(p,s);}

const html=`<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover">
<meta name="theme-color" content="#08070d"><title>WhatsApp do cliente · SaintsAI</title>
<link rel="stylesheet" href="css/styles.css"><script src="js/theme.js"></script><script src="js/guard.js"></script>
<style>
.flow{max-width:760px;margin:0 auto;padding:18px 14px 120px}.head{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:14px 0 20px}.step{padding:10px 5px;border-radius:14px;text-align:center;background:rgba(127,127,127,.08);font-size:12px;font-weight:700;opacity:.58}.step.active,.step.done{opacity:1}.step.active{border:1px solid rgba(151,91,255,.55);background:rgba(151,91,255,.13)}
.card{background:var(--surface,#111018);border:1px solid rgba(150,90,240,.24);border-radius:20px;padding:17px;margin-bottom:14px}.field{display:grid;gap:7px}.field input{width:100%;box-sizing:border-box}
.badgebox{padding:12px;border-radius:14px;background:rgba(127,127,127,.08);margin:12px 0}.code{font-size:28px;font-weight:900;letter-spacing:3px;text-align:center;padding:16px;border-radius:14px;background:rgba(151,91,255,.1);margin-top:12px;min-height:36px}
.help{font-size:13px;opacity:.72;line-height:1.5;margin-top:10px}.bottom{position:fixed;left:0;right:0;bottom:0;padding:12px 14px calc(12px + env(safe-area-inset-bottom));background:rgba(9,8,14,.95);backdrop-filter:blur(14px);border-top:1px solid rgba(127,127,127,.18);z-index:20}.bottom>div{max-width:760px;margin:auto;display:flex;gap:10px}.bottom button{flex:1}.status{min-height:20px;margin-top:10px;font-size:13px}
@media(max-width:480px){.step{font-size:11px;padding:9px 2px}}
</style></head><body>
<main class="flow">
<div class="head"><a id="voltar" class="btn-secondary small" href="#">← Plano</a><div><h1 style="margin:0">WhatsApp do cliente</h1><p id="sub" style="margin:4px 0 0;opacity:.7">Carregando…</p></div></div>
<div class="steps"><div class="step done">1. IA</div><div class="step done">2. Plano</div><div class="step active">3. WhatsApp</div><div class="step">Concluído</div></div>
<div id="erro" class="error-msg hidden"></div>

<section class="card">
<h2 style="margin-top:0">3. Conectar WhatsApp</h2>
<p style="opacity:.75">Digite o número do cliente. O SaintsAI gera um código de pareamento para vincular o WhatsApp.</p>
<div id="estado" class="badgebox">Verificando conexão…</div>
<div class="field"><label for="numero"><strong>Número do WhatsApp</strong></label><input id="numero" type="tel" inputmode="tel" autocomplete="tel" placeholder="43 99999-9999"></div>
<button id="gerar" class="btn-primary" type="button" style="width:100%;margin-top:12px">Gerar código de conexão</button>
<div id="codigo" class="code"></div>
<div class="help">No celular do cliente: WhatsApp → Aparelhos conectados → Conectar um aparelho → Conectar com número de telefone. Digite o código acima.</div>
<div id="status" class="status" role="status"></div>
</section>

<section class="card"><strong>Quando conectar</strong><p style="opacity:.72;margin-bottom:0">A tela detecta automaticamente a conexão e libera a finalização do cadastro.</p></section>
</main>
<div class="bottom"><div><button id="concluir" class="btn-primary" type="button" disabled>Concluir cadastro</button></div></div>
<script src="js/config.js"></script><script src="js/auth.js"></script><script src="js/api.js"></script>
<script>
const lojaId=new URLSearchParams(location.search).get('loja');let conectado=false,timer=null;
const $=id=>document.getElementById(id);$('voltar').href='admin-cliente-plano.html?loja='+encodeURIComponent(lojaId||'');
function mostrarErro(m){$('erro').textContent=m;$('erro').classList.remove('hidden');}
async function statusWa(){
 if(!lojaId)return;
 try{
  const s=await apiFetch('/lojas/'+encodeURIComponent(lojaId)+'/whatsapp/waha/status');
  conectado=Boolean(s.connected);
  $('estado').textContent=conectado?'WhatsApp conectado':'Status: '+(s.status==='NOT_FOUND'?'não conectado':s.status);
  $('concluir').disabled=!conectado;
  if(conectado){$('status').textContent='Conexão confirmada. Você pode concluir o cadastro.';$('codigo').textContent='';}
 }catch(_){}
}
async function carregar(){
 if(!lojaId)return mostrarErro('Cliente inválido.');
 try{
  const c=await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId));
  $('sub').textContent=c.nome||c.email||'Cliente';
  if(c.whatsapp&&c.whatsapp.numero_whatsapp)$('numero').value=c.whatsapp.numero_whatsapp;
  await statusWa();timer=setInterval(statusWa,5000);
 }catch(e){if(e instanceof SessaoExpiradaError)return fazerLogout();mostrarErro(e.message||'Não foi possível carregar o cliente.');}
}
$('gerar').onclick=async()=>{
 const phone=$('numero').value.replace(/\D/g,'');if(phone.length<10)return $('status').textContent='Digite um número válido com DDD.';
 const b=$('gerar');b.disabled=true;b.textContent='Gerando código…';$('codigo').textContent='';$('status').textContent='';
 try{
  const r=await apiFetch('/lojas/'+encodeURIComponent(lojaId)+'/whatsapp/waha/pair',{method:'POST',body:JSON.stringify({phone_number:phone})});
  $('codigo').textContent=r.code||'';$('status').textContent='Código gerado. Aguardando confirmação no WhatsApp.';
  await statusWa();
 }catch(e){if(e instanceof SessaoExpiradaError)return fazerLogout();$('status').textContent=e.message||'Não foi possível gerar o código.';}
 finally{b.disabled=false;b.textContent='Gerar código de conexão';}
};
$('concluir').onclick=()=>{if(!conectado)return;$('concluir').disabled=true;window.location.href='admin-cliente-concluido.html?loja='+encodeURIComponent(lojaId);};
carregar();
</script></body></html>`;

const done=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover"><meta name="theme-color" content="#08070d"><title>Cliente concluído · SaintsAI</title><link rel="stylesheet" href="css/styles.css"><script src="js/theme.js"></script><script src="js/guard.js"></script><style>.wrap{max-width:680px;margin:0 auto;padding:42px 16px}.card{background:var(--surface,#111018);border:1px solid rgba(150,90,240,.24);border-radius:24px;padding:24px}.ok{font-size:48px}.actions{display:grid;gap:10px;margin-top:20px}</style></head><body><main class="wrap"><section class="card"><div class="ok">✓</div><h1>Cliente configurado</h1><p id="nome">IA, plano e WhatsApp concluídos.</p><div class="actions"><a class="btn-primary" href="admin.html" style="text-align:center;text-decoration:none">Voltar para Clientes</a><a class="btn-secondary" id="abrir" href="#" style="text-align:center;text-decoration:none">Abrir cliente</a></div></section></main><script src="js/config.js"></script><script src="js/auth.js"></script><script src="js/api.js"></script><script>const id=new URLSearchParams(location.search).get('loja');document.getElementById('abrir').href='admin-cliente.html?loja='+encodeURIComponent(id||'');if(id)apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(id)).then(c=>{document.getElementById('nome').textContent=(c.nome||'Cliente')+' está com IA, plano e WhatsApp configurados.';}).catch(()=>{});</script></body></html>`;

write('public/admin-cliente-whatsapp.html',html);
write('public/admin-cliente-concluido.html',done);
console.log('Etapa 3 e conclusão do onboarding Admin aplicadas.');
