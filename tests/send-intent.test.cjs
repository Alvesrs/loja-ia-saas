'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const row={id:'synthetic',status:'processando',tentativas:2,lease_ate:new Date(Date.now()+240000).toISOString(),ultimo_erro_codigo:null,resposta_texto:null};
 let fail=false;
 const db={from(table){assert.equal(table,'whatsapp_fila_processamento');let write;const filters=[];const q={update(v){write=v;return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},select(){return q},async maybeSingle(){if(fail)return{error:{code:'synthetic'}};if(filters.some(([k,v])=>row[k]!==v))return{data:null};Object.assign(row,write);return{data:{id:row.id}}}};return q}};
 const module={exports:{}};vm.runInNewContext(fs.readFileSync('src/services/whatsappSendIntent.service.js','utf8'),{module,require:()=>db,Date,Number,Error});
 return{...module.exports,row,job:{...row},failure:()=>fail=true};
}
test('competing workers persist exactly one send intent for the same lease',async()=>{
 const f=fixture();const r=await Promise.all([f.prepare(f.job,{resposta:'Confirmar'}),f.prepare(f.job,{resposta:'Confirmar'})]);
 assert.equal(r.filter(Boolean).length,1);assert.equal(f.row.ultimo_erro_codigo,'envio_em_andamento');assert.equal(f.row.resposta_texto,'Confirmar');
});
test('expired lease cannot authorize send',async()=>{
 const f=fixture();assert.equal(await f.prepare({...f.job,lease_ate:new Date(0).toISOString()},{resposta:'Teste'}),false);assert.equal(f.row.resposta_texto,null);
});
test('reclaimed lease rejects stale worker attempt without mutation',async()=>{
 const f=fixture();f.row.tentativas++;assert.equal(await f.prepare(f.job,{resposta:'Teste'}),false);assert.equal(f.row.ultimo_erro_codigo,null);
});
test('database failure prevents authorization and preserves original state',async()=>{
 const f=fixture();f.failure();await assert.rejects(f.prepare(f.job,{resposta:'Teste'}),/intencao_envio_indisponivel/);assert.equal(f.row.ultimo_erro_codigo,null);
});
test('uncertain recovery preserves response and requires review, without requeue',async()=>{
 const f=fixture();await f.prepare(f.job,{resposta:'Confirmar'});assert.equal(f.uncertain(f.row),true);assert.equal(await f.quarantine(f.job),true);
 assert.equal(f.row.status,'falhou');assert.equal(f.row.ultimo_erro_codigo,'envio_incerto');assert.equal(f.row.resposta_texto,'Confirmar');assert.equal(f.row.lease_ate,null);
});
test('stale worker cannot quarantine a newer lease',async()=>{
 const f=fixture();f.row.tentativas++;assert.equal(await f.quarantine(f.job),false);assert.equal(f.row.status,'processando');
});
test('confirmed sent jobs only finalize even if they retain an intent marker',()=>{
 const f=fixture();assert.equal(f.uncertain({...f.job,status:'enviado',ultimo_erro_codigo:'envio_em_andamento'}),false);
});
