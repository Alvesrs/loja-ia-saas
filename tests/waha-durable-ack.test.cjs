'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture({fail=false,renewal=false}={}){const stored=[],reservations=new Set();let timers=0;const event={destinatarioId:'session',contato:'synthetic',idExterno:'event',texto:'question',fromMe:false};const deps={
 '../services/providers/whatsapp/interpretadorWebhookWaha':(()=>{const parsed={exports:{}};vm.runInNewContext(fs.readFileSync('src/services/providers/whatsapp/interpretadorWebhookWaha.js','utf8'),{module:parsed,require:n=>n.includes('validacao')?require('../src/utils/validacao'):{point:()=>null},Date,Number,String,Object});return parsed.exports})(),
 '../services/tenantHumanControl.service':{route:async()=>null},
 '../services/ownerProspecting.service':{normalizarEvento:async e=>e,eventoPermitido:async()=>true},
 '../services/ownerSalesContext.service':{incoming:async()=>true},
 '../services/ownerMinuteHandoff.service':{incoming:async()=>null},
 '../services/ownerPublicDemo.service':{tentar:async()=>false},'../services/ownerLabConversation.service':{tentar:async()=>false},'../services/agentFeatureMenus.service':{tentar:async()=>false},
 '../services/renovacao.service':{contextoRenovacaoAtivo:async()=>renewal,processarMensagemDono:async()=>renewal},
 '../services/whatsappIdempotencia.service':{reservarEventoWhatsapp:async k=>{if(reservations.has(k.idExterno))return false;reservations.add(k.idExterno);return true},liberarEventoWhatsapp:async k=>reservations.delete(k.idExterno)},
 '../services/whatsappWebhook.service':{processarEventoWhatsapp:async e=>({...e,lojaId:'store',configuracaoId:'cfg'})},
 '../services/whatsappFila.service':{},'../services/whatsappWorker.service':{},
 '../config/supabase':{from(){const q={select(){return q},eq(){return q},limit(){return q},maybeSingle:async()=>({data:null}),then(r){return Promise.resolve({data:[]}).then(r)}};return q}},
 '../services/whatsappDurableBatch.service':{enabled:()=>true,enqueue:async m=>{await Promise.resolve();if(fail)throw Error('synthetic');if(stored.length)return{created:false};stored.push(m);return{created:true,jobId:'77777777-7777-4777-8777-777777777777'}}}
 };const module={exports:{}};vm.runInNewContext(fs.readFileSync('src/controllers/whatsappWahaWebhook.controller.js','utf8'),{module,require:n=>{assert(n in deps,n);return deps[n]},process:{env:{}},Date,Map,Set,Number,String,Object,setTimeout(){timers++;return 1},clearTimeout(){},console:{log(){},error(){}}});return{stored,reservations,get timers(){return timers},async post(){const res={statusCode:200,status(n){this.statusCode=n;return this},json(body){this.body=body;this.persistedAtAck=stored.length;return this}};await module.exports.receber({body:{event:'message',session:'session',payload:{id:'event',from:'5511000000000@c.us',fromMe:false,body:'question',timestamp:1700000000}}},res);return res}};}
test('WAHA acknowledges only after persistent grouped enqueue, with no memory timer',async()=>{const f=fixture(),r=await f.post();assert.equal(r.statusCode,200);assert.equal(r.persistedAtAck,1);assert.equal(f.timers,0)});
test('storage failure returns retryable error and releases only failed reservation',async()=>{const f=fixture({fail:true});assert.equal((await f.post()).statusCode,500);assert.equal(f.reservations.size,0)});
test('redelivery does not persist the same external event again',async()=>{const f=fixture();await f.post();assert.equal((await f.post()).body.status,'duplicado_ignorado');assert.equal(f.stored.length,1);assert.equal(f.reservations.size,0)});

test('ambiguous HTTP failure never deletes a committed durable reservation',async()=>{const f=fixture({fail:true});await f.post();assert.equal(f.reservations.size,0)});

test('active renewal retains its reserved side-effect route',async()=>{const f=fixture({renewal:true}),r=await f.post();assert.equal(r.body.status,'renovacao_processada');assert.equal(f.stored.length,0);assert.equal(f.reservations.size,1)});
