const fs=require('node:fs');
const cp=require('node:child_process');
const os=require('node:os');
const path=require('node:path');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

fs.copyFileSync('patches/assets/cliente-whatsapp.html','public/cliente-whatsapp.html');

/* Backend exclusivo do portal cliente */
let c=read('src/controllers/clienteHub.controller.js');
if(!c.includes("const wahaOnboarding = require('../services/wahaOnboarding.service');")){
  const anchor="const { usuarioEhAdmin } = require('../middleware/admin');";
  if(!c.includes(anchor))throw new Error('Import admin do clienteHub não encontrado');
  c=c.replace(anchor,anchor+"\nconst wahaOnboarding = require('../services/wahaOnboarding.service');");
}

if(!c.includes('async function statusWhatsappCliente(req,res){')){
  const exp=c.lastIndexOf('module.exports=');
  if(exp<0)throw new Error('Export clienteHub não encontrado');
  const fn=[
"async function statusWhatsappCliente(req,res){",
"  try{",
"    const loja=await exigirLoja(req,res);if(!loja)return;",
"    const {data,error}=await supabase.from('whatsapp_configuracoes')",
"      .select('id,provedor,numero_whatsapp,ativo,criado_em')",
"      .eq('loja_id',loja.id).eq('ativo',true)",
"      .order('criado_em',{ascending:false}).limit(10);",
"    if(error)throw error;",
"    const configs=data||[];",
"    const cfg=configs.find(x=>x.provedor==='waha')||configs.find(x=>x.provedor==='meta')||configs[0]||null;",
"    if(!cfg)return res.json({conectado:false,provedor:null,numero_whatsapp:null});",
"    let conectado=true;",
"    if(cfg.provedor==='waha'){",
"      try{const st=await wahaOnboarding.status(loja.id);conectado=!!st.connected;}catch(_){conectado=false;}",
"    }",
"    return res.json({conectado,provedor:cfg.provedor||null,numero_whatsapp:cfg.numero_whatsapp||null});",
"  }catch(e){console.error('[cliente-hub] whatsapp status',e?.message||e);return res.status(500).json({erro:'Não foi possível consultar o WhatsApp.'});}",
"}",
"",
"async function parearWhatsappCliente(req,res){",
"  try{",
"    const loja=await exigirLoja(req,res);if(!loja)return;",
"    const phone=String(req.body?.phone_number||'').trim();",
"    const x=await wahaOnboarding.iniciarPareamento(loja.id,phone);",
"    return res.json(x);",
"  }catch(e){",
"    const status=Number(e?.status||500);",
"    console.error('[cliente-hub] whatsapp pair',e?.message||e);",
"    return res.status(status).json({erro:e?.message||'Não foi possível iniciar a conexão do WhatsApp.'});",
"  }",
"}",
""
  ].join('\n');
  c=c.slice(0,exp)+fn+c.slice(exp);
}

c=c.replace(/module\.exports=\{([^}]*)\}/,(m,inside)=>{
  let items=inside.trim().replace(/,$/,'');
  if(!items.includes('statusWhatsappCliente'))items+=',statusWhatsappCliente';
  if(!items.includes('parearWhatsappCliente'))items+=',parearWhatsappCliente';
  return 'module.exports={'+items+'}';
});
write('src/controllers/clienteHub.controller.js',c);

let r=read('src/routes/clienteHub.routes.js');
if(!r.includes("'/whatsapp/status'")){
  const anchor="r.get('/inicio',c.inicioCliente);";
  if(!r.includes(anchor))throw new Error('Rota inicio clienteHub não encontrada');
  r=r.replace(anchor,anchor+"\nr.get('/whatsapp/status',c.statusWhatsappCliente);\nr.post('/whatsapp/pair',c.parearWhatsappCliente);");
}
write('src/routes/clienteHub.routes.js',r);

/* Etapa WhatsApp aponta somente para a página do cliente */
let cfg=read('public/cliente-configuracao.html');
cfg=cfg.replace("location.href='whatsapp.html'","location.href='cliente-whatsapp.html'");
cfg=cfg.replace(/href=[\"']whatsapp\.html[\"']/g,'href="cliente-whatsapp.html"');
write('public/cliente-configuracao.html',cfg);

/* Rotas explícitas ANTES dos mounts estáticos para bloquear a página antiga */
let app=read('src/app.js');
const clientMount="app.use('/cliente', require('express').static(__saintsaiClientDir";
let ci=app.indexOf(clientMount);
if(ci<0)throw new Error('Mount /cliente não encontrado');
if(!app.includes('SAINTSAI_CLIENT_WHATSAPP_ISOLATED_V1')){
  const block=[
    "// SAINTSAI_CLIENT_WHATSAPP_ISOLATED_V1",
    "app.get(['/cliente/cliente-whatsapp.html','/cliente/whatsapp.html'],(_req,res)=>{",
    "  res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');",
    "  res.set('Pragma','no-cache');res.set('Expires','0');",
    "  return res.sendFile(__saintsaiClientPath.join(__saintsaiClientDir,'cliente-whatsapp.html'));",
    "});",
    ""
  ].join('\n');
  app=app.slice(0,ci)+block+app.slice(ci);
}

const painelMount="app.use('/painel', require('express').static";
let pi=app.indexOf(painelMount);
if(pi<0)throw new Error('Mount /painel não encontrado');
if(!app.includes("'/painel/cliente-whatsapp.html'")){
  const block=[
    "app.get('/painel/cliente-whatsapp.html',(_req,res)=>{",
    "  res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');",
    "  res.set('Pragma','no-cache');res.set('Expires','0');",
    "  return res.sendFile(require('node:path').join(process.cwd(),'public','cliente-whatsapp.html'));",
    "});",
    ""
  ].join('\n');
  app=app.slice(0,pi)+block+app.slice(pi);
}
write('src/app.js',app);

for(const p of ['src/controllers/clienteHub.controller.js','src/routes/clienteHub.routes.js','src/app.js']){
  cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
}

const html=read('public/cliente-whatsapp.html');
if(html.includes('dashboard.html')||html.includes('/painel'))throw new Error('Tela WhatsApp cliente ainda referencia painel antigo');
const re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;let m,n=0;
while((m=re.exec(html))){
  const code=m[1].trim();if(!code)continue;
  const tmp=path.join(os.tmpdir(),'saintsai-client-whatsapp-'+(++n)+'.js');
  fs.writeFileSync(tmp,code);
  try{cp.execFileSync(process.execPath,['--check',tmp],{stdio:'inherit'});}finally{try{fs.unlinkSync(tmp)}catch(_){}}
}
if(!n)throw new Error('Tela WhatsApp cliente sem JavaScript');
console.log('WhatsApp do cliente isolado do painel antigo.');
