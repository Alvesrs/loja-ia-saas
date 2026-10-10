const db=require('../config/supabase');
async function checked(r){if(r.error)throw r.error;return r.data;}
async function enabled(lojaId){if(!process.env.SAINTSAI_OWNER_USER_ID)return false;const row=await checked(await db.from('saintsai_sales_onboarding').select('conversa_id,owner_store_id').eq('customer_store_id',lojaId).maybeSingle());if(!row?.conversa_id||!row.owner_store_id)return false;
const c=await checked(await db.from('saintsai_sales_conversations').select('loja_id,contato,briefing').eq('id',row.conversa_id).eq('loja_id',row.owner_store_id).maybeSingle());if(c?.briefing?.__lab_subscription_test!==true||!['554396431742@c.us','5543996431742@c.us','554396431742','5543996431742'].includes(c.contato))return false;
const store=await checked(await db.from('lojas').select('dono_id').eq('id',row.owner_store_id).maybeSingle());return store?.dono_id===process.env.SAINTSAI_OWNER_USER_ID;}
function price(code){return {basico:1,pro:2,ilimitado:3}[code];}
module.exports={enabled,price};
