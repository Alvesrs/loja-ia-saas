'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const reserved=new Set(),jobs=new Map(),calls=[];let fail;
 const parser=require('../src/services/providers/whatsapp/interpretadorWebhookMeta');
 const deps={
 '../services/providers/whatsapp/interpretadorWebhookMeta':parser,
 '../services/whatsappWebhookAssinatura.service':{},
 '../services/whatsappWorker.service':new Proxy({}, {get(){throw Error('Webhook must not invoke worker')}}),
 '../services/whatsappWebhook.service':{ErroEventoWhatsappInvalido:class extends Error{},ErroDestinatarioNaoIdentificado:class extends Error{},async processarEventoWhatsapp(e,c){assert.equal(c.provedor,'meta');calls.push(e);return e;}},
 '../services/whatsappIdempotencia.service':{async reservarEventoWhatsapp(k){if(reserved.has(k.idExterno))return false;reserved.add(k.idExterno);return true;},async liberarEventoWhatsapp(k){reserved.delete(k.idExterno);}},
 '../services/whatsappFila.service':{async enfileirarMensagemWhatsapp(m){if(m.idExterno===fail)throw Error('synthetic storage failure');jobs.set(m.idExterno,m);return m;}}
 };
 const module={exports:{}};vm.runInNewContext(fs.readFileSync('src/controllers/whatsappWebhook.controller.js','utf8'),{module,require:n=>{assert(n in deps,n);return deps[n]},console:{error(){}}});
 const payload=ids=>({object:'whatsapp_business_account',entry:[{id:'synthetic',changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:'synthetic-destination'},messages:ids.map(id=>({id,from:'5511000000000',timestamp:'1700000000',type:'text',text:{body:'synthetic question'}}))}}]}]});
 return{jobs,reserved,calls,setFail(id){fail=id},async post(ids){const res={statusCode:200,status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};await module.exports.receberEvento({body:payload(ids)},res);return res}};
}
test('all messages in one Meta delivery are persisted before acknowledgment',async()=>{const f=fixture();assert.equal((await f.post(['a','b','c'])).statusCode,200);assert.equal(f.jobs.size,3);});
test('duplicate at start does not suppress later new messages',async()=>{const f=fixture();await f.post(['a']);await f.post(['a','b']);assert.equal(f.jobs.size,2);});
test('failed partial batch retries only missing jobs without releasing persisted reservations',async()=>{const f=fixture();f.setFail('b');assert.equal((await f.post(['a','b','c'])).statusCode,500);assert.deepEqual([...f.jobs.keys()],['a']);assert.deepEqual([...f.reserved],['a']);f.setFail();assert.equal((await f.post(['a','b','c'])).statusCode,200);assert.equal(f.jobs.size,3);});
test('entire repeated batch acknowledges duplicates without additional jobs',async()=>{const f=fixture();await f.post(['a','b']);const r=await f.post(['a','b']);assert.equal(r.body.status,'duplicado_ignorado');assert.equal(f.jobs.size,2);});
test('simultaneous repeated deliveries reserve each external id once',async()=>{const f=fixture();await Promise.all([f.post(['a','b']),f.post(['a','b'])]);assert.equal(f.jobs.size,2);assert.equal(f.reserved.size,2);});
