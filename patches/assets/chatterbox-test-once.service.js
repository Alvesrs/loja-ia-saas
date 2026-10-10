const db=require('../config/supabase');
const idem=require('./whatsappIdempotencia.service');
const voice=require('./salesVoice.service');
const STORE='a0cd14cc-af0b-4bee-967d-5becf99351ae';
const CONTACT='554396431742@c.us';
async function run(){
 const {data:c,error}=await db.from('saintsai_sales_conversations').select('id,session_id,contato,loja_id,configuracao_id,briefing').eq('loja_id',STORE).eq('contato',CONTACT).maybeSingle();
 if(error)throw error;if(!c||c.briefing?.__saintsai_test!==true)return;
 const {data:l,error:el}=await db.from('lojas').select('dono_id').eq('id',STORE).maybeSingle();if(el)throw el;if(!process.env.SAINTSAI_OWNER_USER_ID||l?.dono_id!==process.env.SAINTSAI_OWNER_USER_ID)return;
 const {data:actual,error:ea}=await db.from('saintsai_sales_onboarding').select('id').eq('conversa_id',c.id).limit(1);if(ea)throw ea;if(actual?.length)return;
 const {data:cfg,error:ec}=await db.from('whatsapp_configuracoes').select('provedor,identificador_externo,ativo').eq('id',c.configuracao_id).maybeSingle();if(ec)throw ec;if(!cfg?.ativo||cfg.provedor!=='waha'||cfg.identificador_externo!==c.session_id)return;
 const event={provedor:'waha',idExterno:'chatterbox-ptbr-approved-test-20261010-v1'};
 // Durable claim precedes all sends: a restart never resends an uncertain delivery.
 if(!await idem.reservarEventoWhatsapp(event)){
  // Read-only reconciliation of the original accepted send; never send again.
  const {data:prior,error:ep}=await db.from('whatsapp_eventos_processados').select('status').eq('provedor',event.provedor).eq('id_externo',event.idExterno).maybeSingle();if(ep)throw ep;if(prior?.status==='concluido')return;
  const base=String(process.env.WAHA_BASE_URL||'').replace(/\/+$/,'');
  const r=await fetch(base+'/api/'+encodeURIComponent(c.session_id)+'/chats/'+encodeURIComponent(c.contato)+'/messages?limit=20&downloadMedia=false',{headers:{'X-Api-Key':process.env.WAHA_API_KEY},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('chatterbox_historico_http_'+r.status);
  const list=await r.json(),items=Array.isArray(list)?list:(list.messages||[]);
  const found=items.find(m=>m.fromMe===true&&m.timestamp>=1791640620&&m.timestamp<=1791640680&&(m.media?.mimetype?.startsWith('audio/')||m._data?.message?.audioMessage||m._data?.type==='ptt'||m.type==='ptt'));
  if(!found){console.log('[chatterbox.test] historico_sem_confirmacao',JSON.stringify(items.slice(0,3).map(m=>({timestamp:m.timestamp,fromMe:m.fromMe,hasMedia:m.hasMedia,type:m.type,mediaType:m.media?.mimetype,keys:Object.keys(m._data||{})}))));return;}
  if(found.ack===-1||found.ackName==='ERROR')throw Error('chatterbox_entrega_rejeitada');
  await idem.concluirEventoWhatsapp(event);
  await activate(c);
  console.log('[chatterbox.test] envio_verificado_no_historico',found.ackName||found.ack||'aceito');
  return;
 }
 const data=await voice.gerarAudio('Enquanto você atende um cliente, eu posso cuidar das mensagens e ajudar a marcar os próximos horários. Pode me pedir um áudio por aqui quando quiser ouvir uma explicação.',true);
 await voice.enviarWaha(c.session_id,c.contato,data);
 await idem.concluirEventoWhatsapp(event);
 await activate(c);
 console.log('[chatterbox.test] envio_confirmado');
}
async function activate(c){
 const {error:update}=await db.from('saintsai_sales_conversations').update({ativo:true,ultimo_audio_em:new Date().toISOString(),audio_divulgado:true,briefing:{...c.briefing,__test_phase:'voice_demo'},atualizado_em:new Date().toISOString()}).eq('id',c.id);if(update)throw update;
}
module.exports={run};
