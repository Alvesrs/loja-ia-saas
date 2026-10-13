'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{execFile}=require('node:child_process');
if(process.env.SAINTSAI_ISOLATED_POSTGRES!=='1'||process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!=='saintsai_stability_test')throw Error('Este teste exige PostgreSQL local isolado da CI.');
const columns=new Set(['id','status','tentativas','lease_ate','ultimo_erro_codigo','resposta_texto','atualizado_em']);
const col=k=>{assert(columns.has(k),k);return '"'+k+'"';};
const value=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replace(/'/g,"''")+"'";
function sql(statement){return new Promise((resolve,reject)=>execFile('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-c',statement],{timeout:10000},(error,out)=>error?reject(Error('isolated_postgres_query_failed')):resolve(out.trim())));}
const table='saintsai_stability.whatsapp_fila_processamento';
const id='77777777-7777-4777-8777-777777777777';
async function reset(){
 await sql(`CREATE SCHEMA IF NOT EXISTS saintsai_stability;
 CREATE TABLE IF NOT EXISTS ${table}(id uuid PRIMARY KEY,status text NOT NULL,tentativas integer NOT NULL,lease_ate timestamptz,ultimo_erro_codigo text,resposta_texto text,atualizado_em timestamptz NOT NULL DEFAULT now());
 TRUNCATE ${table};
 INSERT INTO ${table}(id,status,tentativas,lease_ate) VALUES(${value(id)},'processando',2,now()+interval '4 minutes');`);
 return read();
}
async function read(){return JSON.parse(await sql(`SELECT row_to_json(q) FROM ${table} q WHERE id=${value(id)}`));}
function service({invalidTable=false}={}){
 const db={from(name){assert.equal(name,'whatsapp_fila_processamento');let fields;const filters=[];const q={update(v){fields=v;return q},eq(k,v){filters.push(col(k)+' = '+value(v));return q},is(k,v){assert.equal(v,null);filters.push(col(k)+' IS NULL');return q},select(){return q},async maybeSingle(){try{const target=invalidTable?'saintsai_stability.missing_test_table':table;const result=await sql(`UPDATE ${target} SET ${Object.entries(fields).map(([k,v])=>col(k)+' = '+value(v)).join(',')} WHERE ${filters.join(' AND ')} RETURNING json_build_object('id',id)`);return{data:result?JSON.parse(result):null};}catch(_){return{error:{code:'isolated_postgres_error'}};}}};return q;}};
 const module={exports:{}};vm.runInNewContext(fs.readFileSync('patches/assets/whatsappSendIntent.service.js','utf8'),{module,require:n=>{assert.equal(n,'../config/supabase');return db;},Date,Number,Error});return module.exports;
}
test('Postgres compare-and-swap admits one of eight independent contenders',async()=>{
 const job=await reset(),f=service();const results=await Promise.all(Array.from({length:8},()=>f.prepare(job,{resposta:"Confirmar d'água"})));
 assert.equal(results.filter(Boolean).length,1);const row=await read();assert.equal(row.ultimo_erro_codigo,'envio_em_andamento');assert.equal(row.resposta_texto,"Confirmar d'água");
});
test('Postgres rejects a worker after the job is reclaimed',async()=>{
 const job=await reset();await sql(`UPDATE ${table} SET tentativas=3 WHERE id=${value(id)}`);
 assert.equal(await service().prepare(job,{resposta:'Teste'}),false);assert.equal((await read()).ultimo_erro_codigo,null);
});
test('expired lease never persists send authorization',async()=>{
 const job=await reset();assert.equal(await service().prepare({...job,lease_ate:new Date(0).toISOString()},{resposta:'Teste'}),false);assert.equal((await read()).resposta_texto,null);
});
test('fresh connection recovers durable intent as uncertain and preserves response',async()=>{
 const job=await reset();await service().prepare(job,{resposta:'Entrega a conferir'});const persisted=await read(),fresh=service();
 assert.equal(fresh.uncertain(persisted),true);assert.equal(await fresh.quarantine(persisted),true);const final=await read();assert.equal(final.status,'falhou');assert.equal(final.ultimo_erro_codigo,'envio_incerto');assert.equal(final.resposta_texto,'Entrega a conferir');
});
test('actual SQL failure cannot authorize send or alter the existing job',async()=>{
 const job=await reset();await assert.rejects(service({invalidTable:true}).prepare(job,{resposta:'Teste'}),/intencao_envio_indisponivel/);assert.equal((await read()).ultimo_erro_codigo,null);
});
