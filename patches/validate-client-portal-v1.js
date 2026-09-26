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

console.log('Portal cliente validado: Home + onboarding + configuração em abas separadas, sem erro de sintaxe.');

// SAINTSAI_FINAL_CLIENT_PORTAL_HEAD

// SAINTSAI_ONBOARDING_REFERENCE_DEPLOY_HEAD

// SAINTSAI_CONFIG_TABS_FINAL_HEAD

// SAINTSAI_CLIENT_HUB_ADMIN_ACCESS_FINAL
