'use strict';
const fs=require('node:fs');
function replace(s,a,b){if(!s.includes(a))throw Error('Booking confirmation anchor missing');return s.replace(a,b);}
for(const file of ['asaasAgendamentoPix.service.js','pagBankPix.service.js']){
 const p='src/services/'+file;let s=fs.readFileSync(p,'utf8');if(s.includes('confirmationSendStarted'))continue;
 const start=s.indexOf(file.startsWith('asaas')?'async function confirmarWhatsapp(':'async function enviarConfirmacaoPagamento('),end=s.indexOf('\nasync function ',start+1);if(start<0||end<0)throw Error('Booking confirmation function missing');let f=s.slice(start,end);
 f=replace(f,'try{','let confirmationSendStarted=false;try{');
 if(file.startsWith('asaas')){
  f=replace(f,'if(error||!claim)return;','if(error)throw Error(\'booking_confirmation_database_unavailable\');if(!claim)return;');
  f=replace(f,'const [{data:cfgs},{data:s}]','const [{data:cfgs,error:configError},{data:s,error:serviceError}]');
  f=replace(f,"const cfg=(cfgs||[])","if(configError||serviceError)throw Error('booking_confirmation_database_unavailable');const cfg=(cfgs||[])");
 }
 f=replace(f,'await envio.enviarRespostaWhatsapp(',"confirmationSendStarted=true;const delivery=await envio.enviarRespostaWhatsapp(");
 if(file.startsWith('asaas'))f=replace(f,'identificador_externo}));}catch(e){',"identificador_externo}));if(delivery?.status!=='enviado')throw Error('booking_confirmation_unconfirmed');}catch(e){");
 else f=replace(f,'    return true;',"    if(delivery?.status!=='enviado')throw Error('booking_confirmation_unconfirmed');\n    return true;");
 f=replace(f,"await supabase.from('saintsai_agendamentos').update({pagamento_confirmacao_enviada_em:null}).eq('id',claim.id).eq('loja_id',claim.loja_id);","if(!confirmationSendStarted)await supabase.from('saintsai_agendamentos').update({pagamento_confirmacao_enviada_em:null}).eq('id',claim.id).eq('loja_id',claim.loja_id).eq('pagamento_confirmacao_enviada_em',agora);");
 s=s.slice(0,start)+f+s.slice(end);
 if(file.startsWith('asaas'))s=s.replace("console.error('[asaas-agenda-confirmacao]',e?.message||e)","console.error('[asaas-agenda-confirmacao]', 'delivery_requires_review')");
 fs.writeFileSync(p,s);
}
