'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const rhythm=require('../patches/assets/conversationRhythm.service');
const text='O SaintsAI pode responder dúvidas frequentes com as informações do seu negócio, enquanto você atende os clientes. Isso ajuda a manter a conversa andando durante as pausas, sem precisar olhar o celular o tempo todo.';
function fixture(mode){const calls=[],messages=[],saved=[];const deps={
 './whatsappFila.service':{STATUS:{ENVIADO:'enviado'},marcarJobEnviado:async(_,t)=>saved.push(t),concluirJob:async()=>calls.push('done'),reagendarOuFalharJob:async()=>calls.push('retry'),reagendarFinalizacaoJob:async()=>calls.push('finalize'),ErroFilaWhatsapp:class extends Error{}},
 './whatsappHistorico.service':{registrarMensagemRecebida:async()=>{},registrarMensagemEnviada:async()=>{},ErroHistoricoWhatsapp:class extends Error{}},
 './whatsappAtendente.service':{responderMensagemWhatsapp:async()=>({resposta:text,salesDialogue:true})},
 './whatsappEnvio.service':{enviarRespostaWhatsapp:async(_,r)=>{messages.push(r.resposta);if(mode==='timeout'&&messages.length===2)throw Error('timeout');return{status:'enviado'}},ErroEnvioWhatsapp:class extends Error{}},
 './whatsappIdempotencia.service':{concluirEventoWhatsapp:async()=>{},ErroIdempotenciaBanco:class extends Error{}},
 './assinaturas.service':{obterSituacaoPlano:async()=>({ativo:true})},'./salesVoice.service':{enviarSeAplicavel:async()=>({enviado:false})},'./agendaLembretes.service':{},'./asaasAgendamentoPix.service':{},
 './ownerMinuteHandoff.service':{before:async()=> 'ready',canSend:async()=>!(mode==='human'&&messages.length)},
 './whatsappSendIntent.service':{uncertain:()=>false,prepare:async()=>{calls.push('intent');return true},quarantine:async()=>calls.push('quarantine')},
 './ownerSellerTest.service':{stale:async()=>false},'./ownerProspecting.service':{permitido:async()=>true},
 './ownerSalesMediaClean.service':{clean:v=>v},'./pixCopyMessage.service':{clean:v=>v},'./ownerSalesFreshReply.service':{superseded:async()=>false},
 './conversationRhythm.service':{send:args=>rhythm.send({...args,gate:deps['./ownerMinuteHandoff.service'].canSend,fresh:async()=>false,sleep:async()=>{}})}
};const module={exports:{}};vm.runInNewContext(fs.readFileSync('src/services/whatsappWorker.service.js','utf8'),{module,require:n=>{assert(n in deps,n);return deps[n]},console:{error(){}},Date,Object,String,Number,process:{env:{}}});return{calls,messages,saved,worker:module.exports};}
const job={id:'synthetic',status:'processando',texto:'Como funciona?',loja_id:'tenant',contato:'synthetic',id_externo:'synthetic'};
test('worker preserves durable send intent and records both confirmed bubbles once',async()=>{const f=fixture(),r=await f.worker.processarJob(job);assert.equal(r.ok,true);assert.equal(f.messages.length,2);assert.deepEqual(f.saved,[f.messages.join('\n\n')]);assert(f.calls.includes('intent'));assert(!f.calls.includes('retry'));});
test('human takeover after the first bubble records only the delivered text',async()=>{const f=fixture('human'),r=await f.worker.processarJob(job);assert.equal(r.ok,true);assert.equal(f.messages.length,1);assert.deepEqual(f.saved,f.messages);assert(!f.calls.includes('retry'));});
test('ambiguous second bubble is quarantined and never automatically replayed',async()=>{const f=fixture('timeout'),r=await f.worker.processarJob(job);assert.equal(r.revisaoEnvio,true);assert.equal(f.messages.length,2);assert(f.calls.includes('quarantine'));assert(!f.calls.includes('retry'));assert.equal(f.saved.length,0);});
