'use strict';
const supabase=require('../config/supabase');
const sub=require('./asaasSubconta.service');
const EVENTS=['PAYMENT_CREATED','PAYMENT_UPDATED','PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_OVERDUE','PAYMENT_REFUNDED','PAYMENT_DELETED'];
const locks=new Map();
async function config(id){const {data,error}=await supabase.from('saintsai_pagamento_config').select('*').eq('loja_id',id).maybeSingle();if(error)throw error;return data;}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='asaas.com'||u.hostname.endsWith('.asaas.com'))&&!u.username&&!u.password?u.href:null;}catch(_){return null;}}
function registration(raw){const allowed=new Set(['APPROVED','PENDING','AWAITING_APPROVAL','REJECTED']);return Object.fromEntries(['general','commercialInfo','bankAccountInfo','documentation'].map(k=>[k,allowed.has(raw?.[k])?raw[k]:'UNKNOWN']));}
async function status(id){
 const pc=await config(id),c=sub.cfg(),connected=Boolean(pc?.provedor==='asaas'&&pc.conectado&&pc.provedor_secret_id);
 const result={plataforma:{configurado:Boolean(c.rootKey),ambiente:connected?(pc?.provedor_ambiente==='sandbox'?'sandbox':'production'):c.ambiente},conectado:connected,status:connected?pc.provedor_status:null,pix_online:connected&&Boolean(pc.aceita_pix_online),verificado:false,cadastro:null,documentos:[]};
 if(!connected)return result;
 try{
  const key=await sub.obterApiKeyLoja(id);result.plataforma.ambiente=key.startsWith('$aact_hmlg_')?'sandbox':key.startsWith('$aact_prod_')?'production':result.plataforma.ambiente;
  const raw=await sub.req('/v3/myAccount/status/',{},key);result.cadastro=registration(raw);result.verificado=true;result.status=result.cadastro.general;
  if(result.status!=='UNKNOWN'){const {error}=await supabase.from('saintsai_pagamento_config').update({provedor_status:result.status,provedor_conta_resumo:'Asaas · '+(result.status==='APPROVED'?'Cadastro aprovado':'Cadastro em validação')}).eq('loja_id',id).eq('provedor','asaas').eq('provedor_secret_id',pc.provedor_secret_id);if(error)throw error;}
  const recent=pc.provedor_status==='SUBCONTA_CRIADA'&&Date.now()-Date.parse(pc.atualizado_em||'')<15000;
  if(recent){result.documentos_disponiveis_em=15;return result;}
  if(result.cadastro.documentation!=='APPROVED')try{const docs=await sub.req('/v3/myAccount/documents',{},key);result.documentos=(Array.isArray(docs)?docs:docs?.data||[]).slice(0,20).map(d=>({status:String(d.status||''),descricao:String(d.description||d.type||'Documento solicitado').slice(0,400),url:safeUrl(d.onboardingUrl)}));}catch(_){result.documentos_indisponiveis=true;}
 }catch(_){result.verificado=false;result.cadastro=null;result.erro_consulta='Não foi possível confirmar a situação no Asaas. Tente atualizar novamente.';}
 return result;
}
async function connect(id,d){
 if(locks.has(id))throw new Error('conexao_em_andamento');
 const work=(async()=>{
  const c=sub.cfg(),key=String(d.chave_api||'').trim(),email=String(d.email||'').trim();
  if(key.length<20||key.length>2048||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('chave_email_invalidos');
  if(!c.rootKey||!/^https:\/\//.test(c.publicBase))throw new Error('asaas_nao_configurado');
  const current=await config(id);if(current?.conectado)throw new Error('conta_ja_conectada');
  const env=key.startsWith('$aact_hmlg_')?'sandbox':key.startsWith('$aact_prod_')?'production':c.ambiente;
  if(env!==c.ambiente)throw new Error('ambiente_incompativel');
  const raw=await sub.req('/v3/myAccount/status/',{},key),cadastro=registration(raw);
  const url=c.publicBase+'/api/pagamentos/asaas/subconta/webhook';
  const hooks=await sub.req('/v3/webhooks?limit=100',{},key);
  const own=(hooks.data||[]).find(h=>h.url===url&&h.name==='SaintsAI pagamentos '+id);
  const payload={name:'SaintsAI pagamentos '+id,url,email,enabled:true,interrupted:false,apiVersion:3,authToken:sub.tokenWebhook(id),sendType:'SEQUENTIALLY',events:EVENTS};
  const hook=await sub.req('/v3/webhooks'+(own?.id?'/'+encodeURIComponent(own.id):''),{method:own?'PUT':'POST',body:payload},key);
  if(!hook?.id)throw new Error('webhook_nao_confirmado');
  const {data:secretId,error:se}=await supabase.rpc('saintsai_store_payment_secret',{p_loja_id:id,p_secret:JSON.stringify({apiKey:key,criado_em:new Date().toISOString()})});if(se)throw se;
  const pc={loja_id:id,provedor:'asaas',conectado:true,provedor_secret_id:secretId,provedor_usuario_id:null,provedor_public_key:null,provedor_ambiente:env,provedor_status:cadastro.general,provedor_conta_resumo:'Asaas · '+(cadastro.general==='APPROVED'?'Cadastro aprovado':'Cadastro em validação'),aceita_pix_online:false,atualizado_em:new Date().toISOString()};
  const {error}=await supabase.from('saintsai_pagamento_config').upsert(pc,{onConflict:'loja_id'});if(error){await supabase.rpc('saintsai_delete_payment_secret',{p_secret_id:secretId}).catch(()=>{});throw error;}
  if(current?.provedor_secret_id)await supabase.rpc('saintsai_delete_payment_secret',{p_secret_id:current.provedor_secret_id}).catch(()=>{});
  return {ok:true,conectado:true,status:cadastro.general,mensagem:'Conta conectada. As confirmações de pagamento foram integradas ao SaintsAI.'};
 })();locks.set(id,work);try{return await work;}finally{locks.delete(id);}
}
async function create(id,d){if(locks.has(id))throw new Error('conexao_em_andamento');const work=sub.criarSubconta(id,d);locks.set(id,work);try{return await work;}finally{locks.delete(id);}}
module.exports={status,connect,create,safeUrl,registration};
