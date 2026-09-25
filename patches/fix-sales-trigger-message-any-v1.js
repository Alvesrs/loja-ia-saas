const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

const parser='src/services/providers/whatsapp/interpretadorWebhookWaha.js';
let p=read(parser);
p=p.replace("  if (body.event !== 'message') return null;","  if (body.event !== 'message' && body.event !== 'message.any') return null;");
if(!p.includes("source: String(p.source || body.source || '').trim().toLowerCase(),")){
  p=p.replace("    fromMe,","    fromMe,\n    source: String(p.source || body.source || '').trim().toLowerCase(),");
}
write(parser,p);

const ctrl='src/controllers/whatsappWahaWebhook.controller.js';
let c=read(ctrl);
if(!c.includes('const origemManual = evento.source')){
  c=c.replace("  if (evento.fromMe === true) {\n    try {","  if (evento.fromMe === true) {\n    try {\n      const origemManual = evento.source !== 'api';");
}
c=c.replace("      if (texto === GATILHO_VENDAS) {","      if (origemManual && texto === GATILHO_VENDAS) {");
c=c.replace("      if (texto === '/parar') {","      if (origemManual && texto === '/parar') {");
c=c.replace("      if (typeof conversaVendaAtivaPorSessao === 'function' && await conversaVendaAtivaPorSessao(evento)) {","      if (origemManual && typeof conversaVendaAtivaPorSessao === 'function' && await conversaVendaAtivaPorSessao(evento)) {");
write(ctrl,c);

const onboarding='src/services/wahaOnboarding.service.js';
let w=read(onboarding);
w=w.replace("events:['message']","events:['message.any']");
if(!w.includes('async function garantirWebhooksAtivos')){
  const bloco=[
"async function garantirWebhooksAtivos(){",
"  const e=env();",
"  const {data,error}=await supabase.from('whatsapp_configuracoes')",
"    .select('identificador_externo')",
"    .eq('provedor','waha')",
"    .eq('ativo',true)",
"    .not('identificador_externo','is',null);",
"  if(error) throw error;",
"  for(const cfg of (data||[])){",
"    const sessao=String(cfg.identificador_externo||'').trim();",
"    if(!sessao) continue;",
"    const atualizado=await chamar('/api/sessions/'+encodeURIComponent(sessao),{",
"      method:'PUT',",
"      body:JSON.stringify({",
"        name:sessao,",
"        config:{webhooks:[{url:e.publicBase+'/api/webhooks/waha',events:['message.any'],hmac:{key:e.hmac}}]}",
"      })",
"    });",
"    if(!atualizado.ok && atualizado.status!==404){",
"      console.error('[waha] falha_atualizar_webhook',sessao,atualizado.status);",
"    }else{",
"      console.log('[waha] webhook_message_any_ok',sessao);",
"    }",
"  }",
}",
""
  ].join('\n');
  w=w.replace('async function status(lojaId){',bloco+'\nasync function status(lojaId){');
  w=w.replace('module.exports={iniciarPareamento,status,ErroWaha,sessionName};','module.exports={iniciarPareamento,status,garantirWebhooksAtivos,ErroWaha,sessionName};');
}
write(onboarding,w);

const server='src/server.js';
let s=read(server);
if(!s.includes('garantirWebhooksAtivos')){
  s += [
"",
"setTimeout(() => {",
"  try {",
"    const wahaOnboarding = require('./services/wahaOnboarding.service');",
"    wahaOnboarding.garantirWebhooksAtivos()",
"      .catch((erro) => console.error('[waha] atualizar_webhooks_startup', erro && (erro.message || erro)));",
"  } catch (erro) {",
"    console.error('[waha] carregar_atualizador_webhooks', erro && (erro.message || erro));",
"  }",
"}, 1500);",
""
  ].join('\n');
}
write(server,s);

for(const f of [parser,ctrl,onboarding,server]) cp.execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
console.log('WAHA: gatilho por mensagem própria corrigido com message.any e source app/api.');