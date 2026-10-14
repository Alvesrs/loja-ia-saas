'use strict';const db=require('../config/supabase');const WAIT=60000;
async function checked(q){const r=await q;if(r.error)throw Error('human_control_unavailable');return r.data;}
const enabled=()=>process.env.WHATSAPP_DURABLE_BATCH==='1';
function key(q,k){return q.eq('loja_id',k.lojaId).eq('configuracao_id',k.configuracaoId).eq('session_id',k.sessionId).eq('contato',k.contato);}
async function state(k){return checked(key(db.from('whatsapp_human_control').select('*'),k).maybeSingle());}
function timing(row,now=Date.now()){if(!row?.pausado)return 'ready';const human=Date.parse(row.ultima_atividade_em);return !Number.isFinite(human)||now-human<WAIT?'wait':'resume';}
function jobKey(j){return{lojaId:j.loja_id,configuracaoId:j.configuracao_id,sessionId:j.destinatario_id,contato:j.contato};}
async function route(e){
 if(!enabled())return null;
 const cfg=await checked(db.from('whatsapp_configuracoes').select('id,loja_id').eq('provedor','waha').eq('identificador_externo',e.destinatarioId).eq('ativo',true).maybeSingle());if(!cfg)return null;
 const store=await checked(db.from('lojas').select('dono_id').eq('id',cfg.loja_id).maybeSingle());
 if(process.env.SAINTSAI_OWNER_USER_ID&&store?.dono_id===process.env.SAINTSAI_OWNER_USER_ID)return null;
 if(e.fromMe!==true)return{tenant:true};
 if(String(e.source||'').toLowerCase()==='api')return{tenant:true,status:'saida_api_ignorada'};
 const k={lojaId:cfg.loja_id,configuracaoId:cfg.id,sessionId:e.destinatarioId,contato:e.contato},row=await state(k);
 if(String(e.texto||'').trim()!=='*'&&!row?.pausado)return{tenant:true,status:'agente_continua_sem_interrupcao'};
 const now=new Date().toISOString();await checked(db.from('whatsapp_human_control').upsert({loja_id:k.lojaId,configuracao_id:k.configuracaoId,session_id:k.sessionId,contato:k.contato,pausado:true,ultima_atividade_em:now,atualizado_em:now},{onConflict:'loja_id,configuracao_id,session_id,contato'}));
 return{tenant:true,status:String(e.texto||'').trim()==='*'?'controle_humano_por_asterisco':'controle_humano_renovado'};
}
async function before(job){if(!enabled()||job.provedor!=='waha')return'ready';const k=jobKey(job),row=await state(k),d=timing(row);if(d!=='resume')return d;
 const result=await checked(key(db.from('whatsapp_human_control').update({pausado:false,atualizado_em:new Date().toISOString()}),k).eq('ultima_atividade_em',row.ultima_atividade_em).eq('pausado',true).select('loja_id').maybeSingle());return result?'ready':'wait';}
async function canSend(job){if(!enabled()||job.provedor!=='waha')return true;return timing(await state(jobKey(job)))==='ready';}
async function due(job){const row=await state(jobKey(job));const human=Date.parse(row?.ultima_atividade_em);return Number.isFinite(human)&&row?.pausado?new Date(human+WAIT).toISOString():null;}
module.exports={route,before,canSend,due,timing};
