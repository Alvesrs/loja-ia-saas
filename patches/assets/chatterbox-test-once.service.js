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
 if(!await idem.reservarEventoWhatsapp(event))return;
 const data=await voice.gerarAudio('Enquanto você atende um cliente, eu posso cuidar das mensagens e ajudar a marcar os próximos horários. Pode me pedir um áudio por aqui quando quiser ouvir uma explicação.',true);
 await voice.enviarWaha(c.session_id,c.contato,data);
 await idem.concluirEventoWhatsapp(event);
 const {error:update}=await db.from('saintsai_sales_conversations').update({ativo:true,ultimo_audio_em:new Date().toISOString(),audio_divulgado:true,briefing:{...c.briefing,__test_phase:'voice_demo'},atualizado_em:new Date().toISOString()}).eq('id',c.id);if(update)throw update;
 console.log('[chatterbox.test] envio_confirmado');
}
module.exports={run};
