'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const store='11111111-1111-4111-8111-111111111111',config='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='77777777-7777-4777-8777-777777777777';
const msg={lojaId:store,configuracaoId:config,contato:'synthetic',texto:'Teste isolado',idExterno:'synthetic-event'};
function fixture(){
 const writes=[],claims=[],env={};
 const db={from(table){assert.equal(table,'whatsapp_fila_processamento');const q={insert(v){writes.push(v);return q},update(v){writes.push(v);return q},eq(){return q},select(){return q},single:async()=>({data:{id}}),maybeSingle:async()=>({data:{id}})};return q},rpc:async(name,params)=>{claims.push({name,params});return{data:[]}}};
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync('src/services/whatsappFila.service.js','utf8'),{module,require:name=>name==='../config/supabase'?db:require('../src/utils/validacao'),process:{env},Date,Object,String,Number,TypeError});
 return{...module.exports,writes,claims,env};
}
const sent={id,loja_id:store,configuracao_id:config,provedor:'waha',destinatario_id:'synthetic-session',contato:'synthetic',texto:'Teste isolado',id_externo:'synthetic-event',status:'enviado',tentativas:1,resposta_texto:'Entrega confirmada'};
test('enqueue is pending, without lease or consumed attempt, and preserves tenant identity',async()=>{
 const f=fixture(),r=await f.enfileirarMensagemWhatsapp(msg,{provedor:'waha',destinatarioId:'synthetic-session'});
 assert.equal(r.status,'pendente');assert.equal(r.tentativas,0);assert.equal(r.lease_ate,null);
 assert.equal(r.loja_id,store);assert.equal(r.configuracao_id,config);
});
test('human wait schedules a durable sixty-second deadline',async()=>{
 const f=fixture(),before=Date.now();
 await f.enfileirarMensagemWhatsapp(msg,{provedor:'waha',destinatarioId:'synthetic-session',delayMs:60000});
 const deadline=Date.parse(f.writes[0].proxima_tentativa_em);
 assert(deadline>=before+60000);assert(deadline<=Date.now()+60000);
});
test('claim uses configured lease and returns no job for an empty atomic claim',async()=>{
 const f=fixture();f.env.WHATSAPP_WORKER_LEASE_SEGUNDOS='240';
 assert.equal(await f.reivindicarProximoJob(),null);
 assert.equal(f.claims[0].name,'claim_whatsapp_job');assert.equal(f.claims[0].params.p_lease_segundos,240);
});
test('confirmed delivery retry persists response and stays sent, without returning to pending',async()=>{
 const f=fixture();await f.reagendarFinalizacaoJob(sent);
 assert.equal(f.writes[0].status,'enviado');assert.equal(f.writes[0].resposta_texto,sent.resposta_texto);
 assert.equal(f.writes[0].lease_ate,null);assert(Date.parse(f.writes[0].proxima_tentativa_em)>Date.now());
});
test('exhausted finalization preserves confirmed response for review',async()=>{
 const f=fixture();f.env.WHATSAPP_WORKER_MAX_TENTATIVAS='1';await f.reagendarFinalizacaoJob(sent);
 assert.equal(f.writes[0].status,'falhou');assert.equal(f.writes[0].resposta_texto,sent.resposta_texto);
});
test('pre-send transient failure returns to pending with exponential backoff',async()=>{
 const f=fixture();f.env.WHATSAPP_WORKER_RETRY_BASE_MS='1000';await f.reagendarOuFalharJob({...sent,status:'processando',resposta_texto:null,tentativas:2},'falha_transitoria');
 assert.equal(f.writes[0].status,'pendente');assert.equal(f.writes[0].ultimo_erro_codigo,'falha_transitoria');
 assert(Date.parse(f.writes[0].proxima_tentativa_em)>=Date.now()+1900);
});
