'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const row={id:'synthetic',ultimo_evento_id:'prospeccao:iniciado:synthetic:autoatendimento',lead_status:'conversa',briefing_step:0,briefing:{},atualizado_em:new Date().toISOString()};
 const db={from(){let write;const q={select(){return q},eq(){return q},limit(){return q},update(v){write=v;return q},async maybeSingle(){if(write)Object.assign(row,write);return{data:{...row}}},then(resolve){if(write)Object.assign(row,write);return Promise.resolve({data:{...row}}).then(resolve)}};return q;}};
 const module={exports:{}};
 const promptModule={exports:{}},contextModule={exports:{}},policy=require('../src/services/ownerSalesPolicy'),salesCase=require('../src/services/ownerSalesCase.service');
 const linked={'../config/supabase':db,'./ownerSalesPrompt':promptModule.exports,'./ownerSalesPolicy':policy,'./ownerSalesCase.service':salesCase};
 vm.runInNewContext(fs.readFileSync('src/services/ownerSalesContext.service.js','utf8'),{module:contextModule,require:n=>linked[n],Date,String,process:{env:{}}});
 vm.runInNewContext(fs.readFileSync('src/services/ownerSalesPrompt.js','utf8'),{module:promptModule,require:n=>n==='./ownerSalesCase.service'?salesCase:contextModule.exports});
 linked['./ownerSalesPrompt']=promptModule.exports;
 const deps={'../config/supabase':db,'./ownerSalesPrompt':promptModule.exports,'./ownerSalesPolicy':policy,'./ownerSalesOnboarding.service':{available:()=>[{nome:'Básico',precoMensalCentavos:10000}]}};
 vm.runInNewContext(fs.readFileSync('src/services/ownerSalesAutomation.service.js','utf8'),{module,require:n=>{assert(n in deps,n);return deps[n]},Date,String});
 return{...module.exports,row,ask:text=>module.exports.analisar({lojaId:'synthetic-store',contato:'synthetic-contact',pergunta:text})};
}
for(const text of ['Como funciona o SaintsAI?','Quanto custa o plano?','Sim'])test('human commercial response after an automatic greeting is not silenced: '+text,async()=>{
 const f=fixture(),r=await f.ask(text);assert.equal(r.contextoComercial,true);assert.notEqual(r.silencio,true);
});
test('repeated automatic greeting and explicit unrelated request remain silent',async()=>{
 const f=fixture();for(const text of ['Recebemos sua mensagem e retornaremos em breve.','Qual a previsão do tempo?'])assert.equal((await f.ask(text)).silencio,true);
});
test('known external assistant gets plans once, without a repeated response loop',async()=>{
 const f=fixture(),text='Pode me contar os planos para encaminhar ao responsável?';assert.match((await f.ask(text)).resposta,/Planos mensais/);assert.equal(f.row.briefing.__bot_plans_shared,true);assert.equal((await f.ask(text)).silencio,true);
});
test('explicit owner introduction releases known assistant plan suppression',async()=>{
 const f=fixture();f.row.briefing.__bot_plans_shared=true;assert.equal((await f.ask('Olá, sou o dono')).contextoComercial,true);assert.equal(f.row.briefing.__bot_plans_shared,false);
});
