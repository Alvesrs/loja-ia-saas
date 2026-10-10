const db=require('../config/supabase');
async function checked(r){if(r.error)throw r.error;return r.data;}
async function enabled(lojaId){if(!process.env.SAINTSAI_OWNER_USER_ID)return false;const row=await checked(await db.from('saintsai_sales_onboarding').select('conversa_id,owner_store_id').eq('customer_store_id',lojaId).maybeSingle());if(!row?.conversa_id||!row.owner_store_id)return false;
const c=await checked(await db.from('saintsai_sales_conversations').select('loja_id,contato,briefing').eq('id',row.conversa_id).eq('loja_id',row.owner_store_id).maybeSingle());if(c?.briefing?.__lab_subscription_test!==true||!['554396431742@c.us','5543996431742@c.us','554396431742','5543996431742'].includes(c.contato))return false;
const store=await checked(await db.from('lojas').select('dono_id').eq('id',row.owner_store_id).maybeSingle());return store?.dono_id===process.env.SAINTSAI_OWNER_USER_ID;}
function price(code){return {basico:1,pro:2,ilimitado:3}[code];}
module.exports={enabled,price};
async function diagnoseOwnerTest(){
 try{const storeId='fab68b38-95f0-402e-b72b-07b37f2fa621';if(!await enabled(storeId))return;const row=await checked(await db.from('saintsai_sales_onboarding').select('payment').eq('customer_store_id',storeId).maybeSingle());const qr=row?.payment?.provider_qr_id;if(!qr)return;
 const sub=require('./asaasSubconta.service'),cfg=sub.cfg();if(cfg.ambiente!=='production'||!cfg.rootKey)return;
 const account=await sub.req('/v3/myAccount/status/',{method:'GET'},cfg.rootKey);console.log('[owner-payment-diagnostic] account '+JSON.stringify(Object.fromEntries(['commercialInfo','bankAccountInfo','documentation','general'].map(k=>[k,account[k]||null]))));
 const result=await sub.req('/v3/payments?pixQrCodeId='+encodeURIComponent(qr)+'&limit=20',{method:'GET'},cfg.rootKey);console.log('[owner-payment-diagnostic] payments '+JSON.stringify({count:result.totalCount,items:(result.data||[]).map(p=>({status:p.status,value:p.value,billingType:p.billingType,confirmedDate:p.confirmedDate,paymentDate:p.paymentDate,pixTransactionStatus:p.pixTransaction?.status||null}))}));
 }catch(e){console.log('[owner-payment-diagnostic] request_failed '+String(e?.status||e?.name||'Error'));}
}
if(typeof setTimeout==='function'&&typeof process!=='undefined'&&process.env.SAINTSAI_OWNER_USER_ID)setTimeout(()=>diagnoseOwnerTest(),5000);
