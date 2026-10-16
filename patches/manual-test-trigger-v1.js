'use strict';const fs=require('node:fs');
const p='src/services/ownerSalesContext.service.js';let s=fs.readFileSync(p,'utf8');
if(!s.includes('function outgoing(event,activation)'))throw Error('Manual trigger activation anchor missing');
if(!s.includes('manualTestBaseOutgoing'))s+=`
// Explicit owner command: enable sales in this individual conversation only.
function isManualTestTrigger(value){return String(value||'').trim().toLowerCase().replace(/\\s+/g,' ')==='abordagem teste1.0';}
const manualTestBaseOutgoing=module.exports.outgoing;
module.exports.isManualTestTrigger=isManualTestTrigger;
module.exports.outgoing=async(e,activation)=>{
 if(!isManualTestTrigger(e?.texto))return manualTestBaseOutgoing(e,activation);
 if(e?.fromMe!==true||String(e.source||'').toLowerCase()==='api'||!e.idExterno||!/^\\d+@(c\\.us|lid)$/.test(String(e.contato||'')))return null;
 const cfg=await checked(db.from('whatsapp_configuracoes').select('id,loja_id').eq('provedor','waha').eq('identificador_externo',e.destinatarioId).eq('ativo',true).maybeSingle());
 if(!cfg||!owned(await store(cfg.loja_id)))return null;
 const idem=require('./whatsappIdempotencia.service'),key={provedor:'waha',idExterno:'owner-manual-test-trigger:'+e.destinatarioId+':'+e.idExterno};
 if(!await idem.reservarEventoWhatsapp(key))return 'abordagem_teste_ja_ativada';
 try{
  const status=await outgoing({...e,texto:require('./ownerSalesPrompt').INTRO},true);
  if(status!=='venda_manual_identificada')throw Error('manual_test_activation_not_confirmed');
  const c=await checked(db.from('saintsai_sales_conversations').select('id,briefing').eq('loja_id',cfg.loja_id).eq('session_id',e.destinatarioId).eq('contato',e.contato).maybeSingle());
  if(!c)throw Error('manual_test_conversation_missing');
  await checked(db.from('saintsai_sales_conversations').update({ativo:true,pausa_humana:false,ultima_atividade_humana_em:null,briefing:{...(c.briefing||{}),__star_manual:false,__sales_stop:false,__sales_wait_human:false,__sales_context_suspended:false,__sales_opening_done:true,__sales_manual_prompt:require('./ownerSalesPrompt').INTRO,__manual_test_trigger:'abordagem teste1.0'},atualizado_em:new Date().toISOString()}).eq('id',c.id).eq('loja_id',cfg.loja_id).eq('session_id',e.destinatarioId).eq('contato',e.contato));
  await idem.concluirEventoWhatsapp(key);
  return 'abordagem_teste_ativada';
 }catch(err){await idem.liberarEventoWhatsapp(key);throw err;}
};
`;
fs.writeFileSync(p,s);new(require('node:vm').Script)(s);
console.log('[manual-trigger] abordagem teste1.0 ativa vendas somente no contato escolhido pelo dono');
