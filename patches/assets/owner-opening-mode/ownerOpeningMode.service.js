'use strict';const db=require('../config/supabase');
async function checked(q){const r=await q;if(r.error)throw r.error;return r.data;}
async function isOpening(c,lojaId,contato){if(!c||c.briefing?.__sales_stop)return true;if(c.briefing?.__sales_opening_done===true)return false;const convs=await checked(db.from('whatsapp_conversas').select('id').eq('loja_id',lojaId).eq('contato',contato).order('atualizado_em',{ascending:false}).limit(1));if(!convs?.[0])return true;const inputs=await checked(db.from('whatsapp_mensagens').select('id').eq('loja_id',lojaId).eq('conversa_id',convs[0].id).eq('direcao','entrada').limit(1));return !inputs?.length;}
module.exports={isOpening};
