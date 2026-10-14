'use strict';const db=require('../config/supabase');const scope='saintsai_marketing';
function error(message,status){return Object.assign(Error(message),{status});}
async function checked(query){const r=await query;if(r.error)throw error('Não foi possível conferir a permissão agora.',503);return r.data;}
function has(item){const c=item?.business?.saintsai_consent;return c?.scope===scope&&c.item_id===item.id&&c.loja_id===item.loja_id&&c.recorded_by===process.env.SAINTSAI_OWNER_USER_ID&&c.confirmed===true&&!c.revoked_at&&Number.isFinite(Date.parse(c.granted_at))&&typeof c.source==='string'&&c.source.trim().length>=8;}
async function record(user,id,body){
 const owner=process.env.SAINTSAI_OWNER_USER_ID;if(!owner||user?.id!==owner)throw error('Acesso restrito ao dono.',403);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||''))throw error('Contato inválido.',400);
 const item=await checked(db.from('saintsai_prospect_items').select('id,loja_id,status,business,updated_at').eq('id',id).maybeSingle());if(!item)throw error('Contato não encontrado.',404);
 const store=await checked(db.from('lojas').select('id').eq('id',item.loja_id).eq('dono_id',owner).maybeSingle());if(!store)throw error('Escolha um contato da sua própria empresa.',403);
 if(item.status!=='queued')throw error('A abordagem já saiu da fila. Um envio em andamento não pode ser desfeito.',409);
 const now=new Date().toISOString(),previous=item.business?.saintsai_consent;
 let consent;if(body?.revoke===true){consent={...(previous||{}),revoked_at:now};}else{const source=typeof body?.source==='string'?body.source.trim():'';if(body?.confirmed!==true||source.length<8||source.length>500)throw error('Confirme a permissão recebida e informe sua origem (8 a 500 caracteres).',400);consent={scope,item_id:item.id,loja_id:item.loja_id,recorded_by:owner,confirmed:true,granted_at:now,source,revoked_at:null};}
 const saved=await checked(db.from('saintsai_prospect_items').update({business:{...item.business,saintsai_consent:consent},updated_at:now}).eq('id',item.id).eq('loja_id',item.loja_id).eq('status','queued').eq('updated_at',item.updated_at).select('id').maybeSingle());if(!saved)throw error('O contato foi atualizado. Atualize a lista antes de continuar.',409);
 return {ok:true,authorized:body?.revoke!==true};
}
async function allowed(item,ctx){
 if(!has(item)||item.loja_id!==ctx.store.id)return false;
 const c=await checked(db.from('saintsai_sales_conversations').select('briefing,lead_status').eq('loja_id',item.loja_id).eq('contato',item.contact).limit(100));
 return !(c||[]).some(row=>row.briefing?.__sales_stop||['recusou','recusado','encerrado'].includes(row.lead_status));
}
module.exports={has,record,allowed};
