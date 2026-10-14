'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const CA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',CB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function fixture({llm=false,failModel=false}={}){
 const tables={
  lojas:[{id:A,prompt_mestre:'Regra exclusiva da Loja Alfa'},{id:B,prompt_mestre:'Regra exclusiva da Loja Beta'}],
  whatsapp_configuracoes:[{id:CA,loja_id:A,provedor:'meta',identificador_externo:'phone-alpha',ativo:true},{id:CB,loja_id:B,provedor:'meta',identificador_externo:'phone-beta',ativo:true}],
  produtos:[{id:CA,loja_id:A,ativo:true,nome:'Camiseta Alfa',descricao:'Produto Alfa',preco:29.9,estoque:[{tamanho:'P',cor:'Azul',quantidade:1234}]},{id:CB,loja_id:B,ativo:true,nome:'Camiseta Beta',descricao:'Produto Beta',preco:89.9,estoque:[{tamanho:'G',cor:'Verde',quantidade:4321}]}],
  saintsai_servicos:[]
 };
 const reads=[],models=[],cache=new Map();
 const db={from(table){const filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},limit(){return q},async maybeSingle(){const r=run();return{data:r.data[0]||null}},then(a,b){return Promise.resolve(run()).then(a,b)}};function run(){reads.push({table,filters:[...filters]});return{data:(tables[table]||[]).filter(r=>filters.every(([k,v])=>r[k]===v)).map(r=>({...r}))};}return q;}};
 const model={estaConfigurado:()=>llm,gerarResposta:async args=>{models.push(args);if(failModel)throw Error('isolated_model_failure');return 'Resposta isolada';}};
 function load(real){if(cache.has(real))return cache.get(real).exports;const module={exports:{}};cache.set(real,module);vm.runInNewContext(fs.readFileSync(real,'utf8'),{module,exports:module.exports,require:n=>{if(n==='../config/supabase')return db;if(n==='./llm.service')return model;if(n.startsWith('.')){const base=path.resolve(path.dirname(real),n),resolved=[base,base+'.js'].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());assert(resolved,n);return load(resolved);}return require(n);},process:{env:{}},Date,String,Number,Object,Intl,Buffer,Set,Map,console:{log(){},error(){}},fetch(){throw Error('Network forbidden in tenant isolation');}},{filename:real});return module.exports;}
 const svc=name=>load(path.resolve('src/services/'+name+'.service.js'));
 async function resolve(target,extra={}){return svc('whatsappWebhook').processarEventoWhatsapp({destinatarioId:target,contato:'5511999999999',texto:'Quanto custa a camiseta?',idExterno:'synthetic-event',...extra},{provedor:'meta'});}
 async function answer(target,extra={}){const msg=await resolve(target,extra);return{msg,text:await svc('ia').responderPergunta(msg.lojaId,msg.texto)};}
 return{tables,reads,models,resolve,answer};
}
test('configured destination owns tenant identity despite forged identifiers',async()=>{
 const f=fixture(),m=await f.resolve('phone-alpha',{lojaId:B,loja_id:B,configuracaoId:CB});assert.equal(m.lojaId,A);assert.equal(m.configuracaoId,CA);
});
test('same sender in two configured destinations gets separate catalogs and prices',async()=>{
 const f=fixture(),a=await f.answer('phone-alpha'),b=await f.answer('phone-beta');assert.equal(a.msg.contato,b.msg.contato);
 assert.match(a.text,/Alfa/);assert.match(a.text,/29,90/);assert.doesNotMatch(a.text,/Beta|89,90/);
 assert.match(b.text,/Beta/);assert.match(b.text,/89,90/);assert.doesNotMatch(b.text,/Alfa|29,90/);
});
test('catalog query always filters active products by resolved tenant',async()=>{
 const f=fixture();await f.answer('phone-alpha',{lojaId:B});const reads=f.reads.filter(r=>r.table==='produtos');assert(reads.length);for(const r of reads){assert(r.filters.some(([k,v])=>k==='loja_id'&&v===A));assert(r.filters.some(([k,v])=>k==='ativo'&&v===true));}
});
test('model receives only the resolved store context and never exact stock amounts',async()=>{
 const f=fixture({llm:true});await f.answer('phone-alpha',{lojaId:B});assert.equal(f.models.length,1);const sent=JSON.stringify(f.models[0]);assert.match(sent,/Alfa/);assert.doesNotMatch(sent,/Beta|4321|1234/);
});
test('model outage falls back to the same tenant catalog',async()=>{
 const f=fixture({llm:true,failModel:true}),r=await f.answer('phone-beta',{lojaId:A});assert.match(r.text,/Beta/);assert.doesNotMatch(r.text,/Alfa|29,90/);
});
test('inactive or ambiguous destination is rejected before reading any catalog',async()=>{
 const f=fixture();f.tables.whatsapp_configuracoes[0].ativo=false;await assert.rejects(f.resolve('phone-alpha'));assert(!f.reads.some(r=>r.table==='produtos'));
 const g=fixture();g.tables.whatsapp_configuracoes.push({...g.tables.whatsapp_configuracoes[1],identificador_externo:'phone-alpha'});await assert.rejects(g.resolve('phone-alpha'));assert(!g.reads.some(r=>r.table==='produtos'));
});
