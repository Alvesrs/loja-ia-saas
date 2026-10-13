'use strict';
const db=require('../config/supabase');
const checked=async q=>{const r=await q;if(r.error)throw r.error;return r.data;};
function pending(messages,now=Date.now()){
 const sorted=messages.filter(x=>typeof x.body==='string'&&x.body.trim()&&Number.isFinite(Number(x.timestamp))).sort((a,b)=>Number(a.timestamp)-Number(b.timestamp));
 const last=sorted.at(-1);if(!last||last.fromMe!==false||Number(last.timestamp)*1000<now-86400000)return null;
 const lastOut=sorted.findLastIndex(x=>x.fromMe===true);const incoming=sorted.slice(lastOut+1).filter(x=>x.fromMe===false);if(!incoming.length)return null;
 const id=typeof last.id==='string'?last.id:last.id?._serialized||last.id?.id;if(!id)return null;
 return {id,text:incoming.map(x=>x.body).join('\n').slice(-12000),timestamp:new Date(Number(last.timestamp)*1000).toISOString()};
}
async function run(){
 // Recover only replies in active, authorized owner conversations; never start outreach.
 const owner=process.env.SAINTSAI_OWNER_USER_ID,base=String(process.env.WAHA_BASE_URL||'').replace(/\/+$/,'');if(!owner||!base||!process.env.WAHA_API_KEY)return;
 const stores=await checked(db.from('lojas').select('id').eq('dono_id',owner));if(!stores?.length)return;
 const convs=await checked(db.from('saintsai_sales_conversations').select('*').in('loja_id',stores.map(x=>x.id)).eq('ativo',true).eq('pausa_humana',false).gte('atualizado_em',new Date(Date.now()-7*86400000).toISOString()).order('atualizado_em',{ascending:false}).limit(10));
 for(const c of convs||[]){
 if(c.briefing?.__sales_stop||c.briefing?.__saintsai_test||!/^prospeccao:(aberto|iniciado):/.test(c.ultimo_evento_id||''))continue;
 try{
 const r=await fetch(base+'/api/'+encodeURIComponent(c.session_id)+'/chats/'+encodeURIComponent(c.contato)+'/messages?limit=30&downloadMedia=false',{headers:{'X-Api-Key':process.env.WAHA_API_KEY},signal:AbortSignal.timeout(8000)});if(!r.ok)continue;
 const data=await r.json();let p=pending(Array.isArray(data)?data:data.messages||[]);if(!p){const items=await checked(db.from('saintsai_prospect_items').select('business').eq('loja_id',c.loja_id).eq('contact',c.contato).limit(1));const phone=items?.[0]?.business?.telefone;if(phone){const alt=String(phone)+'@c.us';if(alt!==c.contato){const other=await fetch(base+'/api/'+encodeURIComponent(c.session_id)+'/chats/'+encodeURIComponent(alt)+'/messages?limit=30&downloadMedia=false',{headers:{'X-Api-Key':process.env.WAHA_API_KEY},signal:AbortSignal.timeout(8000)});if(other.ok){const raw=await other.json();p=pending(Array.isArray(raw)?raw:raw.messages||[]);}}}}if(!p)continue;
 const existing=await checked(db.from('whatsapp_fila_processamento').select('id,status,resposta_texto').eq('provedor','waha').eq('id_externo',p.id).limit(1));
 if(!c.ativo){const items=await checked(db.from('saintsai_prospect_items').select('opening').eq('loja_id',c.loja_id).eq('contact',c.contato).eq('status','uncertain').limit(1));const all=Array.isArray(data)?data:data.messages||[];const lastOut=all.filter(x=>x.fromMe===true&&typeof x.body==='string').sort((a,b)=>Number(b.timestamp)-Number(a.timestamp))[0];const failedClosing=existing?.[0]?.status==='concluido'&&!existing[0].resposta_texto&&require('./ownerSalesPrompt').recusou(p.text);if(!failedClosing&&(!items?.length||lastOut?.body!==items[0].opening))continue;await checked(db.from('saintsai_sales_conversations').update({ativo:true,atualizado_em:new Date().toISOString()}).eq('id',c.id).eq('atualizado_em',c.atualizado_em));}
 if(existing?.length){if(existing[0].status!=='concluido'||existing[0].resposta_texto)continue;p.id='owner-requested-recovery-v3:'+p.id;const recovered=await checked(db.from('whatsapp_fila_processamento').select('id').eq('provedor','waha').eq('id_externo',p.id).limit(1));if(recovered?.length)continue;}
 const m={canal:'whatsapp',lojaId:c.loja_id,configuracaoId:c.configuracao_id,sessionId:c.session_id,contato:c.contato,texto:p.text,idExterno:p.id,timestamp:p.timestamp};
 if(!await require('./ownerSalesContext.service').approve(m,{activate:true}))continue;
 const idem=require('./whatsappIdempotencia.service'),key={provedor:'waha',idExterno:p.id};if(!await idem.reservarEventoWhatsapp(key))continue;
 try{await require('./whatsappHistorico.service').registrarMensagemRecebida(m,{provedor:'waha',destinatarioId:c.session_id});await require('./whatsappFila.service').enfileirarMensagemWhatsapp(m,{provedor:'waha',destinatarioId:c.session_id});console.log('[owner.reply.recovery] enfileirada '+c.contato.slice(-10));}catch(e){await idem.liberarEventoWhatsapp(key);throw e;}
 }catch(e){console.error('[owner.reply.recovery] '+(e?.name||'Error'));}
 }
}
let running=false,timer;async function guarded(){if(running)return;running=true;try{await run();}catch(e){console.error('[owner.reply.recovery]',e.name);}finally{running=false;}}function begin(){if(timer)return;timer=setInterval(guarded,30000);timer.unref?.();setTimeout(guarded,12000).unref?.();}module.exports={pending,run,begin};
