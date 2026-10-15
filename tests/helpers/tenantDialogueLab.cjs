'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const STORE='11111111-1111-4111-8111-111111111111',CFG='22222222-2222-4222-8222-222222222222';
function laboratory({model='Olá! Como posso te ajudar?',configured=true,services=[],products=[],history=[],failHistory=false,failModel=false}={}){
 const calls={llm:[],history:[],send:[],done:[],retry:[],network:0,agenda:0},cache=new Map(),rows=[];
 const tables={lojas:[{id:STORE,prompt_mestre:'Negócio fictício Alfa. Atendimento gentil. Não conceda desconto.'}],produtos:products.map(p=>({...p,loja_id:STORE,ativo:true})),whatsapp_fila_processamento:rows};
 const db={from(table){const filters=[];const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},neq(k,v){filters.push(r=>r[k]!==v);return q},gt(k,v){filters.push(r=>r[k]>v);return q},lte(k,v){filters.push(r=>r[k]<=v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},order(){return q},limit(){return q},async maybeSingle(){return{data:run().data[0]||null}},then(a,b){return Promise.resolve(run()).then(a,b)}};function run(){return{data:(tables[table]||[]).filter(r=>filters.every(f=>f(r))),error:null}}return q;}};
 let manual=false;
 const deps={
  '../config/supabase':db,
  './llm.service':{estaConfigurado:()=>configured,gerarResposta:async input=>{calls.llm.push(input);if(failModel)throw Error('synthetic_model_outage');return typeof model==='function'?model(input,{rows,calls}):model;}},
  './atendimentoHibrido.service':{buscarServicos:async loja=>{assert.equal(loja,STORE);return services;},contextoServicos:ss=>'Serviços: '+ss.map(s=>s.nome+' R$ '+s.preco).join('; '),normalizar:t=>String(t||'').toLowerCase(),tentarFoto:async()=>null},
  './salesSeller.service':{conversaAtiva:async()=>false},
  './ownerSalesContext.service':{approve:async()=>true},'./ownerProspecting.service':{permitido:async()=>true},
  './professionalCommission.service':{tentar:async()=>null},'./galleryProductConsent.service':{tentar:async()=>null},
  './ownerSellerTest.service':{stale:async()=>false},
  './agendaWhatsapp.service':{tentarResponder:async()=>{calls.agenda++;return null}},
  './galeriaAtendimento.service':{tentar:async()=>null},'./videoAtendimento.service':{tentarVideo:async()=>null},
  './entregaWhatsapp.service':{tentar:async()=>null},'./commerceCatalog.service':{tentar:async()=>null},
  './whatsappHistorico.service':{obterHistoricoRecente:async(...args)=>{calls.history.push(args);if(failHistory)throw Error('synthetic_history_outage');return structuredClone(history)},registrarMensagemRecebida:async()=>{},registrarMensagemEnviada:async()=>{},ErroHistoricoWhatsapp:class extends Error{}},
  './whatsappFila.service':{STATUS:{ENVIADO:'enviado'},ErroFilaWhatsapp:class extends Error{},concluirJob:async id=>calls.done.push(id),marcarJobEnviado:async()=>{},reagendarOuFalharJob:async()=>calls.retry.push('retry'),reagendarFinalizacaoJob:async()=>calls.retry.push('finalize')},
  './whatsappIdempotencia.service':{concluirEventoWhatsapp:async()=>{},ErroIdempotenciaBanco:class extends Error{}},
  './whatsappEnvio.service':{enviarRespostaWhatsapp:async(_,r)=>calls.send.push(r),ErroEnvioWhatsapp:class extends Error{}},
  './assinaturas.service':{obterSituacaoPlano:async()=>({ativo:true})},'./salesVoice.service':{enviarSeAplicavel:async()=>({enviado:false})},
  './agendaLembretes.service':{},'./asaasAgendamentoPix.service':{},
  './ownerMinuteHandoff.service':{before:async()=>manual?'wait':'ready',canSend:async()=>!manual},
  './whatsappSendIntent.service':{uncertain:()=>false,prepare:async()=>true},
  './ownerSalesMediaClean.service':{clean:v=>v},'./pixCopyMessage.service':{clean:v=>v}
 };
 function load(file){if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,require:n=>{if(n in deps)return deps[n];if(n.startsWith('.')){const p=path.resolve(path.dirname(file),n);return load(p.endsWith('.js')?p:p+'.js')}return require(n)},process:{env:{}},Date,String,Number,Object,Boolean,Intl,Buffer,Map,Set,structuredClone,console:{log(){},error(){}},fetch(){calls.network++;throw Error('NETWORK_FORBIDDEN_IN_TENANT_LAB')}},{filename:file});return module.exports;}
 const svc=n=>load(path.resolve('src/services/'+n+'.service.js'));
 const message=text=>({canal:'whatsapp',lojaId:STORE,configuracaoId:CFG,contato:'synthetic-contact',texto:text,idExterno:'synthetic-'+text});
 const job=(id,text,at='2026-10-15T10:00:00Z')=>({id,loja_id:STORE,configuracao_id:CFG,contato:'synthetic-contact',texto:text,criado_em:at,id_externo:'synthetic-'+id,provedor:'waha',destinatario_id:'synthetic-session',status:'processando'});
 return{calls,rows,tables,svc,job,manual(v){manual=v},respond:text=>svc('whatsappAtendente').responderMensagemWhatsapp(message(text)),answer:(text,h=history)=>svc('ia').responderPergunta(STORE,text,h),process:j=>svc('whatsappWorker').processarJob(j)};
}
module.exports={laboratory,STORE,CFG};
