const db=require('../config/supabase');
const {createHash}=require('node:crypto');
const owner=require('./ownerProspecting.service');
const idem=require('./whatsappIdempotencia.service');
const envio=require('./whatsappEnvio.service');
const {INTRO,MASTER}=require('./ownerSalesPrompt');
const erro=(message,status=409)=>Object.assign(Error(message),{status});
async function iniciar(usuario,{lojaId,telefone}={}){
 if(!process.env.SAINTSAI_OWNER_USER_ID||usuario?.id!==process.env.SAINTSAI_OWNER_USER_ID)throw erro('Acesso restrito ao dono.',403);
 const {data:l,error:el}=await db.from('lojas').select('id,dono_id').eq('id',lojaId).maybeSingle();if(el)throw el;if(!l||l.dono_id!==usuario.id)throw erro('Escolha uma loja da sua própria conta.',403);
 if(!/^55\d{10,11}$/.test(String(telefone||'')))throw erro('WhatsApp inválido.',400);
 const {data:cfg,error:ec}=await db.from('whatsapp_configuracoes').select('id,provedor,identificador_externo,numero_whatsapp').eq('loja_id',lojaId).eq('ativo',true).limit(2);if(ec)throw ec;
 if(cfg?.length!==1||cfg[0].provedor!=='waha')throw erro('Conecte seu WhatsApp real por QR no SaintsAI Cliente desta loja para enviar a primeira abordagem.');
 const c=cfg[0],base=String(process.env.WAHA_BASE_URL||'').replace(/\/+$/,'');
 if(!base||!process.env.WAHA_API_KEY)throw erro('Conexão WhatsApp indisponível.',503);
 let sess;try{const r=await fetch(base+'/api/sessions/'+encodeURIComponent(c.identificador_externo),{headers:{'X-Api-Key':process.env.WAHA_API_KEY},signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error();sess=await r.json();}catch{throw erro('Não foi possível confirmar a conexão. Tente novamente.',503);}
 const numero=String(c.numero_whatsapp||'').replace(/\D/g,'');
 if(sess.status!=='WORKING'||!numero||String(sess.me?.id||'').split('@')[0]!==numero)throw erro('Reconecte o WhatsApp desta loja por QR antes de prospectar.');
 if(telefone===numero)throw erro('Escolha um contato diferente do seu próprio número.',400);
 const contato=await owner.chatPorTelefone(c.identificador_externo,telefone);
 const delivery=require('./wahaDelivery.service');
 const {data:prior,error:priorError}=await db.from('saintsai_sales_conversations').select('ultimo_evento_id').eq('session_id',c.identificador_externo).eq('contato',contato).eq('loja_id',lojaId).maybeSingle();if(priorError)throw priorError;
 const existingDelivery=delivery.marker(prior?.ultimo_evento_id);if(existingDelivery?.estado==='failed')throw delivery.fail();
 let messageId=existingDelivery?.id||null,deliveryState=existingDelivery?.estado||'pending';
 const chave={provedor:'waha',idExterno:'prospeccao-abordagem:'+createHash('sha256').update(usuario.id+'|'+telefone).digest('hex')};
 const nova=await idem.reservarEventoWhatsapp(chave);
 if(!nova){const {data,error}=await db.from('whatsapp_eventos_processados').select('status').eq('provedor',chave.provedor).eq('id_externo',chave.idExterno).maybeSingle();if(error)throw error;if(data?.status!=='concluido')throw erro('A abordagem está em andamento ou o envio não foi confirmado. Não será repetida automaticamente.');}
 try{
  const automationKnown=/:autoatendimento$/.test(prior?.ultimo_evento_id||'');
  await owner.autorizar(usuario,{lojaId,telefone});
  if(nova){const mensagem={canal:'whatsapp',lojaId,configuracaoId:c.id,contato,idExterno:chave.idExterno};const resultado=await envio.enviarRespostaWhatsapp(mensagem,{lojaId,contato,idExterno:chave.idExterno,resposta:INTRO},{provedor:'waha',destinatarioId:c.identificador_externo,confirmarEntrega:true});if(resultado.status!=='enviado')throw Error('envio_nao_confirmado');messageId=resultado.idExternoProvider||null;}
  if(deliveryState!=='delivered')deliveryState=await delivery.check(c.identificador_externo,messageId);

  const {error}=await db.from('saintsai_sales_conversations').update({ultimo_evento_id:'prospeccao:iniciado:'+Date.now()+delivery.encode(messageId,deliveryState)+(automationKnown?':autoatendimento':''),atualizado_em:new Date().toISOString()}).eq('session_id',c.identificador_externo).eq('contato',contato).eq('loja_id',lojaId);if(error)throw error;
  if(deliveryState==='failed')throw delivery.fail();
  if(nova)await idem.concluirEventoWhatsapp(chave);
  return{ok:true,status:deliveryState==='delivered'?(nova?'enviada':'ja_enviada'):'pendente_entrega',telefone};
 }catch(e){
  await db.from('saintsai_sales_conversations').update({ativo:false}).eq('session_id',c.identificador_externo).eq('contato',contato).eq('loja_id',lojaId);
  if(e?.deliveryRejected===true)throw delivery.fail();
  throw erro('Não foi possível confirmar a abordagem. Confira o WhatsApp; para evitar duplicação, não haverá reenvio automático.',503);
 }
}
async function promptDaLoja(lojaId){const {data,error}=await db.from('lojas').select('dono_id,prompt_mestre').eq('id',lojaId).maybeSingle();if(error)throw error;return data?.dono_id===process.env.SAINTSAI_OWNER_USER_ID?(require('./ownerSalesPrompt').STYLE+'\n'+(data.prompt_mestre||MASTER)):null;}
module.exports={iniciar:async(usuario,body)=>{const result=await iniciar(usuario,body);try{await require('./ownerSalesOnboarding.service').remember(usuario,body);}catch(_){}return result;},promptDaLoja};
