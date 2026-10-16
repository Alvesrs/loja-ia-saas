'use strict';
const db=require('../config/supabase');
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const REPLY='Vi os horários que vocês divulgaram. Meu contato é sobre o SaintsAI, que ajuda a responder clientes e organizar os agendamentos pelo WhatsApp. É você quem cuida dessa parte?';
function announcement(value){const s=norm(value);if(!s||s.length>1200)return false;
 if(/https?:|www\.|wa\.me/i.test(String(value))||/\b(?:saintsai|voces|seu sistema|seu agente|como funciona|consigo|consegue|posso|podemos|quero|queria|gostaria|nao quero|nao tenho interesse|pare de|remova|obrigado pelo contato|agradecemos|mensagem automatica|fora do horario|aguarde|em breve|assim que possivel)\b/.test(s))return false;
 return /\b(?:temos|tenho|tem) (?:alguns |algum |um |uma )?(?:horarios? (?:livres?|disponiveis?)|vagas?)\b|\b(?:agenda aberta|ultim[ao]s vagas|horarios? (?:livres?|disponiveis?) (?:para|na|no|sexta|sabado|hoje|amanha))\b/.test(s)&&/\b(?:hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|semana|tarde|manha|noite|[0-2]?\d [0-5]\d)\b/.test(s);}
async function checked(q){const r=await q;if(r.error)throw r.error;return r.data;}
async function analisar({lojaId,contato,pergunta}){if(!announcement(pergunta))return null;
 const owner=await checked(db.from('lojas').select('dono_id').eq('id',lojaId).maybeSingle());if(!process.env.SAINTSAI_OWNER_USER_ID||owner?.dono_id!==process.env.SAINTSAI_OWNER_USER_ID)return null;
 const lead=await checked(db.from('saintsai_sales_conversations').select('id,ativo,pausa_humana,lead_status,briefing,ultimo_evento_id').eq('loja_id',lojaId).eq('contato',contato).maybeSingle());
 if(!lead?.ativo||lead.pausa_humana||lead.briefing?.__sales_stop||lead.briefing?.__sales_wait_human||lead.briefing?.__sales_context_suspended||lead.lead_status==='briefing'||!/^prospeccao:(?:aberto|iniciado):/.test(lead.ultimo_evento_id||''))return null;
 const convs=await checked(db.from('whatsapp_conversas').select('id').eq('loja_id',lojaId).eq('contato',contato).order('atualizado_em',{ascending:false}).limit(1));
 if(convs?.[0]){const sent=await checked(db.from('whatsapp_mensagens').select('id').eq('loja_id',lojaId).eq('conversa_id',convs[0].id).eq('direcao','saida').eq('texto',REPLY).limit(1));if(sent?.length)return{silencio:true};}
 return{resposta:REPLY,prospectAvailability:true};
}
module.exports={announcement,analisar,REPLY};
