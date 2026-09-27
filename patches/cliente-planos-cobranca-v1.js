const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const os=require('node:os');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

fs.copyFileSync('patches/assets/clientePlano.controller.js','src/controllers/clientePlano.controller.js');
fs.copyFileSync('patches/assets/clientePlano.routes.js','src/routes/clientePlano.routes.js');
fs.copyFileSync('patches/assets/cliente-plano.html','public/cliente-plano.html');

/* API do plano antes das rotas genéricas /api/lojas */
let app=read('src/app.js');
if(!app.includes("const clientePlanoRoutes=require('./routes/clientePlano.routes');")){
  const a="const express = require('express');";
  if(!app.includes(a))throw new Error('Express require não encontrado');
  app=app.replace(a,a+"\nconst clientePlanoRoutes=require('./routes/clientePlano.routes');");
}
if(!app.includes("app.use('/api/lojas/:lojaId/cliente-plano',clientePlanoRoutes);")){
  const markers=["app.use('/api/lojas',","app.use('/api/lojas', "];
  let pos=-1;
  for(const m of markers){const x=app.indexOf(m);if(x>=0&&(pos<0||x<pos))pos=x;}
  if(pos<0)throw new Error('Mount genérico /api/lojas não encontrado');
  app=app.slice(0,pos)+"app.use('/api/lojas/:lojaId/cliente-plano',clientePlanoRoutes);\n"+app.slice(pos);
}

/* Página própria e sem cache no site e no APK */
if(!app.includes('SAINTSAI_CLIENT_PLAN_PAGE_V1')){
  const clientMount=app.indexOf("app.use('/cliente', require('express').static");
  if(clientMount<0)throw new Error('Mount /cliente não encontrado');
  const route=[
    "// SAINTSAI_CLIENT_PLAN_PAGE_V1",
    "app.get(['/cliente/cliente-plano.html','/cliente/plano.html'],(_req,res)=>{",
    "  res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');",
    "  res.set('Pragma','no-cache');res.set('Expires','0');",
    "  return res.sendFile(require('node:path').join(process.cwd(),'public','cliente-plano.html'));",
    "});",
    ""
  ].join('\n');
  app=app.slice(0,clientMount)+route+app.slice(clientMount);

  const painelMount=app.indexOf("app.use('/painel', require('express').static");
  if(painelMount<0)throw new Error('Mount /painel não encontrado');
  const route2=[
    "app.get('/painel/cliente-plano.html',(_req,res)=>{",
    "  res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');",
    "  res.set('Pragma','no-cache');res.set('Expires','0');",
    "  return res.sendFile(require('node:path').join(process.cwd(),'public','cliente-plano.html'));",
    "});",
    ""
  ].join('\n');
  app=app.slice(0,painelMount)+route2+app.slice(painelMount);
}
write('src/app.js',app);

/* Novas cobranças guardam valor e duração para o histórico */
let asaas=read('src/services/asaas.service.js');
const old="external_reference: externalReference,\n    atualizado_em: new Date().toISOString(),";
if(!asaas.includes('valor_centavos: valorCentavos')){
  if(!asaas.includes(old))throw new Error('Insert de cobrança Asaas não encontrado');
  asaas=asaas.split(old).join("external_reference: externalReference,\n    valor_centavos: valorCentavos,\n    duracao_meses: meses,\n    atualizado_em: new Date().toISOString(),");
}
write('src/services/asaas.service.js',asaas);

/* Plano pago entra no progresso do onboarding */
let hub=read('src/controllers/clienteHub.controller.js');
if(!hub.includes("const {obterSituacaoPlano}=require('../services/assinaturas.service');")){
  const a="const { usuarioEhAdmin } = require('../middleware/admin');";
  if(hub.includes(a))hub=hub.replace(a,a+"\nconst {obterSituacaoPlano}=require('../services/assinaturas.service');");
  else{
    const b="const {usuarioEhAdmin}=require('../middleware/admin');";
    if(!hub.includes(b))throw new Error('Import admin clienteHub não encontrado');
    hub=hub.replace(b,b+"\nconst {obterSituacaoPlano}=require('../services/assinaturas.service');");
  }
}
if(!hub.includes('const situacaoPlano=await obterSituacaoPlano(lojaId);')){
  const a="if(e1||e2||e3||e4)throw (e1||e2||e3||e4);";
  if(!hub.includes(a))throw new Error('Ponto onboarding para plano não encontrado');
  hub=hub.replace(a,a+"\n    const situacaoPlano=await obterSituacaoPlano(lojaId);\n    const planoOk=Boolean(situacaoPlano?.ativo&&!['trial','legado'].includes(String(situacaoPlano?.plano?.codigo||'')));");
}
if(!hub.includes("id:'plano',titulo:'Escolha seu plano SaintsAI'")){
  const a="{id:'operacao',titulo:'Conecte o WhatsApp',descricao:'Ative o número que receberá os clientes.',concluida:whatsappOk,destino:'operacao'}";
  if(!hub.includes(a))throw new Error('Etapa WhatsApp onboarding não encontrada');
  hub=hub.replace(a,a+",\n      {id:'plano',titulo:'Escolha seu plano SaintsAI',descricao:'Escolha seu plano, acompanhe o limite e faça o pagamento da assinatura.',concluida:planoOk,destino:'plano'}");
}
write('src/controllers/clienteHub.controller.js',hub);

/* O cartão de progresso abre a tela correta; demais etapas continuam nas abas */
let central=read('public/cliente-central.html');
const oldDest="function onboardingDestino(destino){location.href='cliente-configuracao.html?etapa='+encodeURIComponent(destino);}";
if(central.includes(oldDest)){
  central=central.replace(oldDest,"function onboardingDestino(destino){location.href=destino==='plano'?'cliente-plano.html':'cliente-configuracao.html?etapa='+encodeURIComponent(destino);}");
}else if(!central.includes("destino==='plano'")){
  const re=/function onboardingDestino\(destino\)\{[^}]*\}/;
  if(!re.test(central))throw new Error('Função onboardingDestino não encontrada');
  central=central.replace(re,"function onboardingDestino(destino){location.href=destino==='plano'?'cliente-plano.html':'cliente-configuracao.html?etapa='+encodeURIComponent(destino);}");
}

/* Atalho permanente no cabeçalho */
if(!central.includes('id="client-plan-link"')){
  const logout='<button class="btn2" onclick="fazerLogout()">Sair</button>';
  if(!central.includes(logout))throw new Error('Botão sair da Home não encontrado');
  central=central.replace(logout,'<div class="client-top-actions"><a id="client-plan-link" class="client-plan-link" href="cliente-plano.html">Plano e cobrança</a>'+logout+'</div>');
}
write('public/cliente-central.html',central);

let css=read('public/css/cliente-dashboard-polish-v3.css');
if(!css.includes('SAINTSAI_PLAN_SHORTCUT_V1')){
  css+="\n/* SAINTSAI_PLAN_SHORTCUT_V1 */\n.client-top-actions{display:flex;align-items:center;gap:8px}.client-plan-link{text-decoration:none;color:#d7c3f7;border:1px solid rgba(167,100,255,.2);background:rgba(126,63,231,.10);border-radius:999px;padding:10px 12px;font-size:11px;font-weight:900}.client-plan-link:active{transform:scale(.98)}@media(max-width:520px){.client-plan-link{padding:9px 10px;font-size:10px}.client-top-actions .btn2{padding:9px 10px}}\n";
}
write('public/css/cliente-dashboard-polish-v3.css',css);

for(const p of ['src/controllers/clientePlano.controller.js','src/routes/clientePlano.routes.js','src/services/asaas.service.js','src/controllers/clienteHub.controller.js','src/app.js']){
  cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
}
const html=read('public/cliente-plano.html');
const re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;let m,n=0;
while((m=re.exec(html))){
  const code=m[1].trim();if(!code)continue;
  const tmp=path.join(os.tmpdir(),'saintsai-client-plan-'+(++n)+'.js');
  fs.writeFileSync(tmp,code);
  try{cp.execFileSync(process.execPath,['--check',tmp],{stdio:'inherit'});}finally{try{fs.unlinkSync(tmp)}catch(_){}}
}
if(!n)throw new Error('Tela de plano sem JavaScript');
console.log('Planos e cobrança do SaintsAI adicionados ao portal cliente.');
