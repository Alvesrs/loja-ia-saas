const fs=require('node:fs');
const cp=require('node:child_process');

function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

let svc=read('src/services/asaasSubconta.service.js');

const anchor="  const body=await req('/v3/accounts',{method:'POST',body:payload});if(!body.id||!body.apiKey)throw new Error('asaas_subconta_resposta_invalida');";
if(!svc.includes(anchor))throw new Error('Anchor criação Asaas não encontrado');

const replacement=anchor+"\n  let statusFinal='SUBCONTA_CRIADA',mensagemFinal='Subconta Asaas criada. O titular deve concluir a ativação e validação recebidas por e-mail.';\n  if(c.ambiente==='sandbox'){try{await req('/v3/accounts/'+encodeURIComponent(String(body.id))+'/approve',{method:'POST'},c.rootKey);statusFinal='SUBCONTA_APROVADA_SANDBOX';mensagemFinal='Subconta Asaas criada e aprovada automaticamente no Sandbox para teste.';}catch(e){console.warn('[asaas-subconta] autoapprove sandbox',e?.status||'',e?.body||e?.message||e);mensagemFinal='Subconta Asaas criada no Sandbox. Se precisar acessar a conta, as comunicações do Sandbox são enviadas ao e-mail da conta-pai.';}}";
svc=svc.replace(anchor,replacement);

svc=svc.replace(
"provedor_status:'SUBCONTA_CRIADA',provedor_conta_resumo:'Asaas ativado · conclua a validação pelo e-mail'",
"provedor_status:statusFinal,provedor_conta_resumo:statusFinal==='SUBCONTA_APROVADA_SANDBOX'?'Asaas Sandbox ativado e aprovado':'Asaas ativado · validação pendente'"
);

svc=svc.replace(
"return {ok:true,conectado:true,status:'SUBCONTA_CRIADA',conta_id:String(body.id),wallet_id:body.walletId?String(body.walletId):null,mensagem:'Subconta Asaas criada. O titular deve concluir a ativação e validação recebidas por e-mail.'};",
"return {ok:true,conectado:true,status:statusFinal,conta_id:String(body.id),wallet_id:body.walletId?String(body.walletId):null,mensagem:mensagemFinal};"
);

const exportAnchor="async function diagnosticarContaPai(){";
if(!svc.includes(exportAnchor))throw new Error('Anchor diagnóstico não encontrado');

const fn=[
"async function aprovarPendentesSandbox(){",
"  const c=cfg();if(c.ambiente!=='sandbox'||!c.rootKey)return;",
"  const {data,error}=await supabase.from('saintsai_pagamento_config').select('loja_id,provedor_usuario_id,provedor_status').eq('provedor','asaas').eq('conectado',true).eq('provedor_status','SUBCONTA_CRIADA').limit(50);",
"  if(error)throw error;",
"  for(const x of data||[]){",
"    if(!x?.provedor_usuario_id)continue;",
"    try{",
"      await req('/v3/accounts/'+encodeURIComponent(String(x.provedor_usuario_id))+'/approve',{method:'POST'},c.rootKey);",
"      await supabase.from('saintsai_pagamento_config').update({provedor_status:'SUBCONTA_APROVADA_SANDBOX',provedor_conta_resumo:'Asaas Sandbox ativado e aprovado',atualizado_em:new Date().toISOString()}).eq('loja_id',x.loja_id);",
"      console.log('[asaas-subconta] sandbox aprovado loja='+String(x.loja_id));",
"    }catch(e){console.warn('[asaas-subconta] sandbox approve pendente',x.loja_id,e?.status||'',e?.body||e?.message||e);}",
"  }",
"}",
""
].join('\n');

svc=svc.replace(exportAnchor,fn+exportAnchor);
svc=svc.replace(
"setTimeout(()=>{diagnosticarContaPai().catch(()=>{});},1200);",
"setTimeout(()=>{diagnosticarContaPai().catch(()=>{});aprovarPendentesSandbox().catch(e=>console.warn('[asaas-subconta] reconcile sandbox',e?.message||e));},1200);"
);
svc=svc.replace(
"module.exports={cfg,configurado,req,status,criarSubconta,obterApiKeyLoja,tokenWebhook,diagnosticarContaPai};",
"module.exports={cfg,configurado,req,status,criarSubconta,obterApiKeyLoja,tokenWebhook,diagnosticarContaPai,aprovarPendentesSandbox};"
);
write('src/services/asaasSubconta.service.js',svc);

let html=read('public/cliente-configuracao.html');
html=html.replace(
"health.textContent='Asaas ativado'+(st.status?' · '+st.status:'')+'. Confira o e-mail do titular para concluir a validação da conta.';",
"health.textContent=st.plataforma?.ambiente==='sandbox'?'Asaas Sandbox ativado'+(st.status?' · '+st.status:'')+'. No Sandbox, a aprovação pode ser automática e as comunicações são enviadas ao e-mail da conta-pai.':'Asaas ativado'+(st.status?' · '+st.status:'')+'. Confira o e-mail do titular para concluir a validação da conta.';"
);
html=html.replace(
"$('asaas-health').textContent='Asaas ativado · aguardando validação do titular';",
"$('asaas-health').textContent=(x.status==='SUBCONTA_APROVADA_SANDBOX'?'Asaas Sandbox ativado e aprovado para teste':'Asaas ativado');"
);
write('public/cliente-configuracao.html',html);

cp.execFileSync(process.execPath,['--check','src/services/asaasSubconta.service.js'],{stdio:'inherit'});
console.log('[asaas-sandbox-autoapprove-v1] PASS autoaprovação segura apenas no Sandbox e mensagem corrigida.');