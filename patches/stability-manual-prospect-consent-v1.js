'use strict';
const fs=require('node:fs');
const file='src/services/ownerFirstMessage.service.js';let s=fs.readFileSync(file,'utf8');
function replace(source,a,b){if(!source.includes(a))throw Error('Manual consent anchor missing');return source.replace(a,b);}
if(!s.includes('recipientPermission')){
 s=replace(s,'abordagem=INTRO){','abordagem=INTRO,recipientPermission=null){');
 s=replace(s,'  if(nova){const mensagem=',"  if(recipientPermission){const permissionWrite=await db.from('saintsai_sales_conversations').update({manual_recipient_permission:{scope:'saintsai_marketing',confirmed:true,source:recipientPermission.source,recorded_by:usuario.id,recorded_at:new Date().toISOString()}}).eq('loja_id',lojaId).eq('session_id',c.identificador_externo).eq('contato',contato).select('id').maybeSingle();if(permissionWrite.error||!permissionWrite.data)throw Error('permission_not_retained');}\n  if(nova){const mensagem=");
 s=replace(s,'const result=await iniciar(usuario,body);',"const permission=body?.recipientPermission;if(permission?.confirmed!==true||typeof permission.source!=='string'||permission.source.trim().length<8||permission.source.trim().length>500)throw erro('Registre a permissão recebida do destinatário antes de iniciar a abordagem.',400);const result=await iniciar(usuario,body,INTRO,{source:permission.source.trim()});");
 s=replace(s,' try{\n  const automationKnown=', ' let providerAttempted=false;\n try{\n  const automationKnown=');
 s=replace(s,'const resultado=await envio.enviarRespostaWhatsapp', 'providerAttempted=true;const resultado=await envio.enviarRespostaWhatsapp');
 s=replace(s,' }catch(e){\n  await db.from', ' }catch(e){\n  if(nova&&!providerAttempted)await idem.liberarEventoWhatsapp(chave);\n  await db.from');
 fs.writeFileSync(file,s);
}
const ui='public/js/owner-prospecting.js';s=fs.readFileSync(ui,'utf8');
if(!s.includes('receberPermissao')){
 const form=`
 function receberPermissao(){return new Promise(resolve=>{
  status.textContent='Registre a permissão recebida para mensagens do SaintsAI. Telefone público não é permissão.';
  const form=document.createElement('form'),label=document.createElement('label'),source=document.createElement('input'),confirmation=document.createElement('input'),checkLabel=document.createElement('label'),save=document.createElement('button'),cancel=document.createElement('button');
  form.dataset.manualConsentForm='1';label.textContent='Como e quando o destinatário autorizou as mensagens?';source.required=true;source.minLength=8;source.maxLength=500;source.type='text';label.append(source);
  confirmation.type='checkbox';confirmation.required=true;checkLabel.append(confirmation,document.createTextNode(' Confirmo que recebi essa permissão do destinatário.'));
  save.type='submit';save.className='btn';save.textContent='Registrar e iniciar abordagem';cancel.type='button';cancel.className='ghost';cancel.textContent='Cancelar';
  let finished=false;function finish(value){if(finished)return;finished=true;form.remove();resolve(value);}
  cancel.onclick=()=>{status.textContent='Abordagem cancelada. Nenhuma mensagem enviada.';finish(null);};
  form.onsubmit=e=>{e.preventDefault();if(!confirmation.checked||source.value.trim().length<8)return;save.disabled=true;finish({confirmed:true,source:source.value.trim()});};
  form.append(label,checkLabel,save,cancel);status.append(form);source.focus();
 });}
`;
 s=replace(s,' const section=document.createElement',form+'\n const section=document.createElement');
 s=s.replace('Ao abrir um contato, a primeira abordagem é enviada automaticamente uma única vez. Ao assumir a conversa novamente ou enviar /parar, a IA pausa.','A primeira abordagem exige a permissão recebida do destinatário e é enviada uma única vez. Envie * sozinho para assumir a conversa; após 60 segundos sem atividade humana, a IA verifica o contexto para reassumir.');
 s=replace(s,"a.dataset.busy='1';abrir(phone);status.textContent='Enviando a primeira abordagem…';try{", "if(document.querySelector('[data-manual-consent-form]'))return;a.dataset.busy='1';try{const storeId=select.value,consent=await receberPermissao();if(!consent)return;if(select.value!==storeId){status.textContent='A loja mudou. Selecione o contato novamente para registrar a permissão da loja correta.';return;}abrir(phone);status.textContent='Enviando a primeira abordagem…';");
 s=replace(s,'telefone:phone,prospect:', 'telefone:phone,recipientPermission:consent,prospect:');
 fs.writeFileSync(ui,s);
}
const page='public/admin-prospeccao.html';
fs.writeFileSync(page,fs.readFileSync(page,'utf8').replace(/js\/owner-prospecting\.js(?:\?[^"']*)?/g,'js/owner-prospecting.js?v=2026.10.14.3'));
