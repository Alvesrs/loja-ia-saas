const fs=require('node:fs');
const cp=require('node:child_process');
const os=require('node:os');
const path=require('node:path');

const file='public/cliente-central.html';
const html=fs.readFileSync(file,'utf8');

const required=[
  'SAINTSAI_CLIENT_UI_V2',
  'SAINTSAI_ONBOARDING_V1',
  'SAINTSAI_HOME_BUSINESS_V2_FINAL',
  'SAINTSAI_ONBOARDING_REFERENCE_V2',
  'id="onboarding-real"',
  'id="notify-config"',
  'id="business-home"',
  'id="biz-hoje"',
  'id="biz-mes"',
  'id="biz-fechamento"',
  'id="clientes-dia"',
  'id="sv-desc"',
  'function trocar(',
  'async function carregar(',
  'async function carregarOnboarding(',
  'function carregarHomeNegocio()',
  'Pronto para atender?',
  'Continuar configuração'
];
for(const marker of required){
  if(!html.includes(marker)) throw new Error('Portal cliente incompleto: '+marker);
}

const re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
let m,i=0;
while((m=re.exec(html))){
  const code=m[1].trim();
  if(!code)continue;
  const tmp=path.join(os.tmpdir(),'saintsai-client-inline-'+(++i)+'.js');
  fs.writeFileSync(tmp,code);
  try{
    cp.execFileSync(process.execPath,['--check',tmp],{stdio:'inherit'});
  }finally{
    try{fs.unlinkSync(tmp)}catch(_){}
  }
}
if(i===0) throw new Error('Nenhum script inline encontrado no portal cliente.');

if(html.includes('await const ')) throw new Error('JavaScript inválido detectado: await const');

const ids=new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map(m=>m[1]));
const refs=new Set();
for(const m of html.matchAll(/\$\(['"]([^"']+)['"]\)/g)) refs.add(m[1]);
for(const m of html.matchAll(/getElementById\(['"]([^"']+)['"]\)/g)) refs.add(m[1]);
const faltando=[...refs].filter(id=>!ids.has(id));
if(faltando.length) throw new Error('Elementos ausentes usados pelo JavaScript: '+faltando.join(', '));

const configFile='public/cliente-configuracao.html';
if(!fs.existsSync(configFile)) throw new Error('Tela separada de configuração não foi criada');
const configHtml=fs.readFileSync(configFile,'utf8');
for(const marker of [
  'Configuração SaintsAI',
  "etapaAtual()",
  "renderIa()",
  "renderServicos()",
  "renderPagamentos()",
  "renderAgenda()",
  "renderOperacao()",
  "cliente-configuracao.html?etapa="
]){
  if(!configHtml.includes(marker)) throw new Error('Configuração separada incompleta: '+marker);
}
if(!html.includes("cliente-configuracao.html?etapa=")) throw new Error('Onboarding ainda não navega para tela separada');
const cre=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
let cm,ci=0;
while((cm=cre.exec(configHtml))){
  const code=cm[1].trim();if(!code)continue;
  const tmp=path.join(os.tmpdir(),'saintsai-config-inline-'+(++ci)+'.js');
  fs.writeFileSync(tmp,code);
  try{cp.execFileSync(process.execPath,['--check',tmp],{stdio:'inherit'});}finally{try{fs.unlinkSync(tmp)}catch(_){}}
}
if(ci===0) throw new Error('Tela de configuração sem JavaScript inline');

const hub=fs.readFileSync('src/controllers/clienteHub.controller.js','utf8');
if(!hub.includes('usuarioEhAdmin(usuario)')) throw new Error('Cliente Hub ainda não permite Admin em cliente gerenciado');
if(!hub.includes("saintsai_managed === true")) throw new Error('Cliente Hub sem trava de cliente gerenciado SaintsAI');

const app=fs.readFileSync('src/app.js','utf8');
const mount="app.use('/api/lojas/:lojaId/cliente-hub', clienteHubRoutes);";
const mi=app.indexOf(mount);
if(mi<0) throw new Error('Rota cliente-hub não está montada no app');
const genericPositions=[
  app.indexOf("app.use('/api/lojas/:lojaId"),
  app.indexOf('app.use("/api/lojas/:lojaId'),
  app.indexOf("app.use('/api/lojas'"),
  app.indexOf('app.use("/api/lojas"')
].filter(i=>i>=0&&i!==mi);
if(genericPositions.length&&mi>Math.min(...genericPositions)) throw new Error('Rota cliente-hub está depois de uma rota genérica /api/lojas');
if(!app.includes("no-store, no-cache, must-revalidate")) throw new Error('Central cliente ainda permite cache antigo');


if(!configHtml.includes('id="ia-sync"')) throw new Error('Configuração IA sem sincronização dos dados da loja');
if(!hub.includes("saintsai_sync_prompt_operacional")) throw new Error('Prompt Mestre sem sincronização operacional');

for(const p of [
  'src/services/bookingPublic.service.js',
  'src/controllers/bookingPublic.controller.js',
  'src/routes/bookingPublic.routes.js',
  'public/agendar.html'
]){
  if(!fs.existsSync(p)) throw new Error('Agendamento público incompleto: '+p);
}
const bookingSvc=fs.readFileSync('src/services/bookingPublic.service.js','utf8');
const agendaSvc=fs.readFileSync('src/services/agendaWhatsapp.service.js','utf8');
const pagbankSvc=fs.readFileSync('src/services/pagBankPix.service.js','utf8');
if(!bookingSvc.includes('preco_alterado')) throw new Error('Agendamento público sem revisão de preço');
if(!bookingSvc.includes('agendamento_duplicado')) throw new Error('Agendamento público sem trava de duplicidade');
if(!bookingSvc.includes("status:pix?'pendente':'confirmado'")) throw new Error('Pix não mantém agendamento pendente até pagamento');
if(!agendaSvc.includes('bookingPublic.criarLink')) throw new Error('WhatsApp ainda não envia link clicável de agendamento');
if(!pagbankSvc.includes('enviarConfirmacaoPagamento')) throw new Error('PagBank não confirma agendamento no WhatsApp após pagamento');
if(!app.includes("app.use('/api/public/agenda', bookingPublicRoutes);")) throw new Error('API pública de agendamento não montada');
if(!app.includes("app.get('/agendar/:token'")) throw new Error('Página pública de agendamento não montada');

const publicHtml=fs.readFileSync('public/agendar.html','utf8');
for(const marker of ['O que você deseja?','Escolha o dia','Escolha o horário','Revise e confirme','Pix para confirmar']){
  if(!publicHtml.includes(marker)) throw new Error('Página de agendamento incompleta: '+marker);
}
const pre=/<script>([\s\S]*?)<\/script>/gi;let pm,pi=0;
while((pm=pre.exec(publicHtml))){
  const code=pm[1].trim();if(!code)continue;
  const tmp=path.join(os.tmpdir(),'saintsai-public-booking-'+(++pi)+'.js');
  fs.writeFileSync(tmp,code);
  try{cp.execFileSync(process.execPath,['--check',tmp],{stdio:'inherit'});}finally{try{fs.unlinkSync(tmp)}catch(_){}}
}
if(pi===0) throw new Error('Página pública sem JavaScript');


for(const p of [
  'public/css/cliente-dashboard-polish-v3.css',
  'public/js/cliente-dashboard-polish-v3.js',
  'public/js/cliente-config-polish-v3.js',
  'src/controllers/servicoImagem.controller.js',
  'src/routes/servicoImagem.routes.js'
]){
  if(!fs.existsSync(p)) throw new Error('Polimento v3 incompleto: '+p);
}
const dashCss=fs.readFileSync('public/css/cliente-dashboard-polish-v3.css','utf8');
const dashJs=fs.readFileSync('public/js/cliente-dashboard-polish-v3.js','utf8');
const configJs=fs.readFileSync('public/js/cliente-config-polish-v3.js','utf8');
for(const m of ['SAINTSAI_DASHBOARD_POLISH_V3','dashboard-setup','dash-stats','dash-record']){
  if(!dashCss.includes(m)) throw new Error('CSS Dashboard v3 incompleto: '+m);
}
for(const m of ['SaintsAI Dashboard','Clientes de hoje','Vendas de hoje','Registros recentes','carregarOnboarding=async function','carregarHomeNegocio=async function']){
  if(!dashJs.includes(m)) throw new Error('Dashboard v3 incompleto: '+m);
}
for(const m of ['Cadastre seu trabalho','Foto do trabalho','renderEquipePolish','quantidade_profissionais','servico-imagem']){
  if(!configJs.includes(m)) throw new Error('Configuração v3 incompleta: '+m);
}
cp.execFileSync(process.execPath,['--check','public/js/cliente-dashboard-polish-v3.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','public/js/cliente-config-polish-v3.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','src/controllers/servicoImagem.controller.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','src/routes/servicoImagem.routes.js'],{stdio:'inherit'});
if(!hub.includes("titulo:'Cadastre seu trabalho'")) throw new Error('Onboarding sem cadastro do trabalho');
if(!hub.includes("titulo:'Configure sua equipe'")) throw new Error('Onboarding sem equipe');
if(!hub.includes("titulo:'Conecte o PagBank'")) throw new Error('Onboarding sem PagBank');
if(!hub.includes('clientes_hoje')) throw new Error('Dashboard sem clientes de hoje');
if(!hub.includes('vendas_hoje')) throw new Error('Dashboard sem vendas de hoje');
if(!hub.includes('salvarEquipe')) throw new Error('Backend sem configuração da equipe');
if(!app.includes("servicoImagemRoutes")) throw new Error('Upload de foto do trabalho não montado');
if(!configHtml.includes('cliente-config-polish-v3.js')) throw new Error('Configuração não carrega polish v3');
if(!html.includes('cliente-dashboard-polish-v3.js')) throw new Error('Home não carrega Dashboard v3');

console.log('Portal cliente validado: SaintsAI Dashboard v3, setup progressivo, fotos, equipe, PagBank e registros operacionais.');

// SAINTSAI_FINAL_CLIENT_PORTAL_HEAD

// SAINTSAI_ONBOARDING_REFERENCE_DEPLOY_HEAD

// SAINTSAI_CONFIG_TABS_FINAL_HEAD

// SAINTSAI_CLIENT_HUB_ADMIN_ACCESS_FINAL

// SAINTSAI_FINAL_BOOKING_VALIDATION

// SAINTSAI_DASHBOARD_POLISH_V3_VALIDATION
