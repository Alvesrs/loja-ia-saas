const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8');}
function write(p,s){fs.writeFileSync(p,s);}

// Backend: consulta administrativa de assinatura de uma loja específica.
let c=read('src/controllers/admin.controller.js');
if(!c.includes('async function obterAssinaturaAdmin')) {
  const fn=`
async function obterAssinaturaAdmin(req, res) {
  const lojaId = String(req.params.lojaId || '');
  if (!ehUuid(lojaId)) return res.status(400).json({ erro: 'Identificador de loja inválido.' });
  const { data: loja, error } = await supabase.from('lojas').select('id, nome').eq('id', lojaId).maybeSingle();
  if (error) return res.status(500).json({ erro: 'Não foi possível consultar a empresa.' });
  if (!loja) return res.status(404).json({ erro: 'Empresa não encontrada.' });
  try {
    const situacao = await obterSituacaoPlano(lojaId);
    return res.json({ loja, situacao, planosDisponiveis: listarPlanos() });
  } catch (erro) {
    console.error('[admin] obter assinatura:', erro?.name || 'erro');
    return res.status(500).json({ erro: 'Não foi possível carregar a assinatura.' });
  }
}
`;
  c=c.replace('\nasync function atualizarAssinatura(req, res) {',fn+'\nasync function atualizarAssinatura(req, res) {');
  c=c.replace(/module\.exports\s*=\s*\{([^}]+)\};/, (m,inner)=>{
    const nomes=inner.split(',').map(s=>s.trim()).filter(Boolean);
    if(!nomes.includes('obterAssinaturaAdmin')) nomes.push('obterAssinaturaAdmin');
    return 'module.exports = { '+nomes.join(', ')+' };';
  });
}
write('src/controllers/admin.controller.js',c);

let r=read('src/routes/admin.routes.js');
if(!r.includes("router.get('/lojas/:lojaId/assinatura'")) {
  r=r.replace(
    "router.put('/lojas/:lojaId/assinatura', exigirAdmin, controller.atualizarAssinatura);",
    "router.get('/lojas/:lojaId/assinatura', exigirAdmin, controller.obterAssinaturaAdmin);\nrouter.put('/lojas/:lojaId/assinatura', exigirAdmin, controller.atualizarAssinatura);"
  );
}
write('src/routes/admin.routes.js',r);

// Etapa 2 mobile-first.
const html=`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover">
<meta name="theme-color" content="#08070d"><title>Plano do cliente · SaintsAI</title>
<link rel="stylesheet" href="css/styles.css"><script src="js/theme.js"></script><script src="js/guard.js"></script>
<style>
.client-flow{max-width:760px;margin:0 auto;padding:18px 14px 120px}.flow-head{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.flow-title{margin:0;font-size:24px}.flow-sub{margin:4px 0 0;opacity:.72;font-size:13px}
.flow-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:14px 0 20px}.flow-step{padding:10px 5px;border-radius:14px;text-align:center;background:rgba(127,127,127,.08);font-size:12px;font-weight:700;opacity:.58}
.flow-step.active,.flow-step.done{opacity:1}.flow-step.active{border:1px solid rgba(151,91,255,.55);background:rgba(151,91,255,.13)}
.flow-card{background:var(--surface,#111018);border:1px solid rgba(150,90,240,.24);border-radius:20px;padding:17px;margin-bottom:14px}
.plan-grid{display:grid;gap:10px}.plan-option{display:block;border:1px solid rgba(127,127,127,.2);border-radius:16px;padding:14px;cursor:pointer}
.plan-option:has(input:checked){border-color:rgba(151,91,255,.8);background:rgba(151,91,255,.11)}.plan-option input{margin-right:8px}
.plan-meta{display:block;opacity:.72;font-size:13px;margin:7px 0 0 26px}.field{display:grid;gap:7px;margin-top:14px}.field input,.field select{width:100%;box-sizing:border-box}
.flow-actions{position:fixed;left:0;right:0;bottom:0;padding:12px 14px calc(12px + env(safe-area-inset-bottom));background:rgba(9,8,14,.95);backdrop-filter:blur(14px);border-top:1px solid rgba(127,127,127,.18);z-index:20}
.flow-actions-inner{max-width:760px;margin:0 auto;display:flex;gap:10px}.flow-actions button{flex:1}.secondary-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.status{min-height:20px;margin-top:10px;font-size:13px}.current{padding:12px;border-radius:14px;background:rgba(127,127,127,.08);margin-bottom:14px}
@media(max-width:480px){.flow-step{font-size:11px;padding:9px 2px}.secondary-row{grid-template-columns:1fr}}
</style>
</head>
<body>
<main class="client-flow">
 <div class="flow-head"><a id="voltar-ia" href="#" class="btn-secondary small" style="text-decoration:none">← IA</a><div><h1 class="flow-title">Plano do cliente</h1><p id="cliente-nome" class="flow-sub">Carregando…</p></div></div>
 <div class="flow-steps"><div class="flow-step done">1. IA</div><div class="flow-step active">2. Plano</div><div class="flow-step">3. WhatsApp</div><div class="flow-step">Concluído</div></div>
 <div id="erro" class="error-msg hidden" role="alert"></div>

 <section class="flow-card">
  <h2 style="margin-top:0">2. Plano e pagamento</h2>
  <p style="opacity:.75">Escolha o plano do cliente. Você pode gerar um link de pagamento pelo Asaas ou ativar manualmente quando o pagamento já estiver confirmado.</p>
  <div id="plano-atual" class="current">Carregando plano atual…</div>
  <div id="planos" class="plan-grid"></div>

  <div class="field">
   <label for="validade"><strong>Validade manual (opcional)</strong></label>
   <input id="validade" type="date">
   <small style="opacity:.68">Deixe vazio para uma assinatura sem data manual de expiração.</small>
  </div>

  <div class="secondary-row">
   <button id="gerar-pagamento" type="button" class="btn-secondary">Gerar link de pagamento</button>
   <button id="ativar-manual" type="button" class="btn-secondary">Ativar manualmente</button>
  </div>
  <div id="status" class="status" role="status"></div>
 </section>
</main>

<div class="flow-actions"><div class="flow-actions-inner"><button id="continuar" type="button" class="btn-primary">Continuar para WhatsApp</button></div></div>

<script src="js/config.js"></script><script src="js/auth.js"></script><script src="js/api.js"></script>
<script>
const lojaId=new URLSearchParams(location.search).get('loja');
let dados=null;
document.getElementById('voltar-ia').href='admin-cliente.html?loja='+encodeURIComponent(lojaId||'');
function erro(msg){const e=document.getElementById('erro');e.textContent=msg;e.classList.remove('hidden');}
function planoSelecionado(){const x=document.querySelector('input[name="plano"]:checked');return x?x.value:null;}
function fmtPreco(c){return c?((c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+'/mês'):'Sem preço configurado';}
function fmtLimite(v){return v===null?'IA ilimitada*':Number(v).toLocaleString('pt-BR')+' mensagens/mês';}
async function carregar(){
 if(!lojaId)return erro('Cliente inválido.');
 try{
  dados=await apiFetch('/admin/lojas/'+encodeURIComponent(lojaId)+'/assinatura');
  document.getElementById('cliente-nome').textContent=dados.loja.nome||'Cliente';
  const s=dados.situacao||{};
  document.getElementById('plano-atual').innerHTML='<strong>Atual:</strong> '+String(s.plano?.nome||s.assinatura?.plano||'Sem plano')+' · '+String(s.statusEfetivo||s.assinatura?.status||'inativo').replace('_',' ');
  document.getElementById('planos').innerHTML=(dados.planosDisponiveis||[]).map((p,i)=>'<label class="plan-option"><input type="radio" name="plano" value="'+p.codigo+'" '+((s.plano&&s.plano.codigo===p.codigo)||(!s.plano&&i===0)?'checked':'')+'><strong>'+p.nome+'</strong><span class="plan-meta">'+fmtLimite(p.limiteMensagensMes)+' · '+fmtPreco(p.precoMensalCentavos)+'</span></label>').join('');
 }catch(e){if(e instanceof SessaoExpiradaError)return fazerLogout();erro(e.message||'Não foi possível carregar os planos.');}
}
async function gerarPagamento(){
 const codigo=planoSelecionado(),st=document.getElementById('status');if(!codigo)return st.textContent='Escolha um plano.';
 const b=document.getElementById('gerar-pagamento');b.disabled=true;st.textContent='Gerando link…';
 try{
  const x=await apiFetch('/lojas/'+encodeURIComponent(lojaId)+'/assinatura/checkout',{method:'POST',body:JSON.stringify({plano:codigo})});
  if(!x.checkout_url)throw new Error('Link de pagamento não recebido.');
  const u=new URL(x.checkout_url);if(u.protocol!=='https:'||!(u.hostname==='asaas.com'||u.hostname.endsWith('.asaas.com')))throw new Error('Link de pagamento inválido.');
  try{await navigator.clipboard.writeText(x.checkout_url);st.textContent='Link de pagamento copiado. Envie ao cliente.';}catch(_){st.innerHTML='<a href="'+x.checkout_url+'" target="_blank" rel="noopener">Abrir pagamento</a>';}
 }catch(e){st.textContent=e.message||'Não foi possível gerar o pagamento.';}finally{b.disabled=false;}
}
async function ativarManual(){
 const codigo=planoSelecionado(),st=document.getElementById('status');if(!codigo)return st.textContent='Escolha um plano.';
 const validade=document.getElementById('validade').value||null;const b=document.getElementById('ativar-manual');b.disabled=true;st.textContent='Ativando…';
 try{
  await apiFetch('/admin/lojas/'+encodeURIComponent(lojaId)+'/assinatura',{method:'PUT',body:JSON.stringify({plano:codigo,status:'ativo',valido_ate:validade})});
  st.textContent='Plano ativado.';await carregar();
 }catch(e){st.textContent=e.message||'Não foi possível ativar o plano.';}finally{b.disabled=false;}
}
document.getElementById('gerar-pagamento').addEventListener('click',gerarPagamento);
document.getElementById('ativar-manual').addEventListener('click',ativarManual);
document.getElementById('continuar').addEventListener('click',()=>{window.location.href='admin-cliente-whatsapp.html?loja='+encodeURIComponent(lojaId);});
carregar();
</script>
</body></html>`;
write('public/admin-cliente-plano.html',html);
console.log('Etapa 2 do onboarding Admin aplicada: plano, pagamento e ativação.');
