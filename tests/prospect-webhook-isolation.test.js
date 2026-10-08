const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture({permitted=true}={}){
 const pending=new Map(),reserved=new Set(),queued=[],calls={voice:0},module={exports:{}};let timerId=0;
 const deps={
  '../services/providers/whatsapp/interpretadorWebhookWaha':{interpretarPayloadWebhookWaha:v=>v},
  '../services/ownerProspecting.service':{normalizarEvento:async v=>v,eventoPermitido:async()=>permitted,saidaDono:async()=> 'vendedor_pausado_por_voce'},
  '../services/whatsappWebhook.service':{processarEventoWhatsapp:async v=>v},
  '../services/whatsappFila.service':{enfileirarMensagemWhatsapp:async v=>{queued.push(v);return {id:'fake'};}},
  '../services/whatsappWorker.service':{},
  '../services/whatsappIdempotencia.service':{reservarEventoWhatsapp:async({idExterno:id})=>{if(reserved.has(id))return false;reserved.add(id);return true;},liberarEventoWhatsapp:async()=>{}},
  '../services/salesVoice.service':{enviarSeAplicavel:async()=>{calls.voice++;throw Error('Direct external audio forbidden');}},
  '../services/renovacao.service':{processarMensagemDono:async()=>false},
  '../config/supabase':{from(){throw Error('Unexpected database access in webhook before queue');}}
 };
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/controllers/whatsappWahaWebhook.controller'),'utf8'),{module,require:n=>{assert(n in deps,n);return deps[n]},process:{env:{}},console:{log(){},error(){}},setTimeout(fn){pending.set(++timerId,fn);return timerId;},clearTimeout(id){pending.delete(id);},fetch(){throw Error('External network forbidden');}});
 async function receive(texto,id='event-1',fromMe=false){const res={statusCode:0,payload:null,status(n){this.statusCode=n;return this;},json(v){this.payload=v;return this;}};await module.exports.receber({body:{texto,idExterno:id,destinatarioId:'fake-session',contato:'isolated@lid',fromMe}},res);return res;}
 async function flush(){for(const fn of pending.values())fn();pending.clear();for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));}
 return {receive,flush,queued,calls};
}
for(const input of ['Me manda um áudio explicando o SaintsAI','Me manda áudio contando uma piada','Não quero, não mande áudio','Olá, estamos fora do horário de atendimento'])test('webhook keeps routing/scope before any output: '+input,async()=>{const f=fixture();const r=await f.receive(input);assert.equal(r.payload.status,'recebido_agrupando');assert.equal(f.calls.voice,0);await f.flush();assert.equal(f.queued.length,1);assert.equal(f.queued[0].texto,input);assert.equal(f.calls.voice,0);});
test('duplicate event is reserved once and never sends directly',async()=>{const f=fixture();await f.receive('Me manda um áudio explicando o SaintsAI');const r=await f.receive('Me manda um áudio explicando o SaintsAI');assert.equal(r.payload.status,'duplicado_ignorado');await f.flush();assert.equal(f.queued.length,1);assert.equal(f.calls.voice,0);});
test('consecutive messages are grouped without repeated text',async()=>{const f=fixture();await f.receive('Como funciona?','1');await f.receive('Qual o preço?','2');await f.receive('Qual o preço?','3');await f.flush();assert.equal(f.queued.length,1);assert.equal(f.queued[0].texto,'Como funciona?\nQual o preço?');});
test('personal contact cannot bypass authorization by requesting audio',async()=>{const f=fixture({permitted:false});assert.equal((await f.receive('Manda áudio')).payload.status,'conversa_pessoal_ignorada');await f.flush();assert.equal(f.queued.length,0);assert.equal(f.calls.voice,0);});
test('owner taking over pauses before any outgoing sales response',async()=>{const f=fixture();assert.equal((await f.receive('Eu assumo','1',true)).payload.status,'vendedor_pausado_por_voce');await f.flush();assert.equal(f.queued.length,0);});
