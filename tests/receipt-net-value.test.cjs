'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function payment(options={}){
 const {enabled=true,gross=30,status='PAYMENT_CONFIRMED'}=options;const net=Object.hasOwn(options,'net')?options.net:27;
 const row={id:'booking',loja_id:'shop',valor:30,status:'confirmado',pagamento_provider_status:status},writes=[];
 const db={from(){let fields;const q={select(){return q},eq(){return q},or(){return q},update(v){fields=v;return q},async maybeSingle(){if(fields)writes.push(fields);return{data:{...row,...fields},error:null}}};return q}};
 const m={exports:{}};vm.runInNewContext(fs.readFileSync('src/services/asaasAgendamentoPix.service.js','utf8'),{module:m,require:n=>n.includes('supabase')?db:{},process:{env:{SAINTSAI_RECEIPT_NET_VALUE:enabled?'1':'0'}},Date,Intl,console});
 return{writes,row,run:()=>m.exports.processar({event:'PAYMENT_RECEIVED',payment:{externalReference:'saintsai_ag:shop:booking',value:gross,netValue:net}})};
}
test('receipt retains provider net amount without changing contractual booking price',async()=>{const f=payment();await f.run();assert.equal(f.writes.length,1);assert.equal(f.writes[0].pagamento_valor_liquido,27);assert.equal(f.writes[0].notificacao_venda_enfileirada,true);assert.equal(f.writes[0].pagamento_status,'pago');assert.equal(f.row.valor,30);assert.equal('valor' in f.writes[0],false)});
test('disabled flag remains compatible with database before the candidate migration',async()=>{const f=payment({enabled:false});await f.run();assert.equal('pagamento_valor_liquido' in f.writes[0],false)});
for(const net of [undefined,null,-1,40,'invalid'])test('missing or invalid provider net amount does not invent a net receipt: '+String(net),async()=>{const f=payment({net});await f.run();assert.equal(f.writes[0].pagamento_valor_liquido,null);assert.equal(f.writes[0].pagamento_status,'pago')});
test('duplicate received event never rewrites the saved amount',async()=>{const f=payment({status:'PAYMENT_RECEIVED'});const r=await f.run();assert.equal(r.duplicado,true);assert.equal(f.writes.length,0)});
test('mismatched gross payment remains rejected without any update',async()=>{const f=payment({gross:31});await assert.rejects(f.run(),{code:'PIX_PAYMENT_MISMATCH'});assert.equal(f.writes.length,0)});
test('notification selects verified net amount and preserves legacy fallback',()=>{const m={exports:{}};vm.runInNewContext(fs.readFileSync('src/services/saleNotificationRetry.service.js','utf8'),{module:m,require:n=>n==='node:crypto'?require(n):{},Date,console});assert.equal(m.exports.receiptNet({valor:30,pagamento_valor_liquido:27}),27);for(const value of [null,undefined,-1,40,'bad'])assert.equal(m.exports.receiptNet({valor:30,pagamento_valor_liquido:value}),30)});
