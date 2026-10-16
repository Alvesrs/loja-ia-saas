'use strict';const fs=require('node:fs');
const source=fs.readFileSync('patches/assets/shortConversation.service.js','utf8');
const inline='(()=>{'+source.replace("'use strict';",'').replace('module.exports=','return ')+'\n})()';
function edit(file,a,b){let s=fs.readFileSync(file,'utf8');if(s.includes(b))return;if(!s.includes(a))throw Error('Short conversation anchor missing: '+file);fs.writeFileSync(file,s.replace(a,b));}
const prompt='src/services/ownerSalesPrompt.js';let s=fs.readFileSync(prompt,'utf8');
if(!s.includes('shortConversationRefusalBase'))s+=`\nmodule.exports.shortConversation=${inline};\nconst shortConversationRefusalBase=module.exports.recusou;module.exports.recusou=v=>module.exports.shortConversation.scopedRefusal(v)?false:module.exports.shortConversation.strongStop(v)||shortConversationRefusalBase(v);\nconst shortConversationScopeBase=module.exports.relacionadaAoSaintsai;module.exports.relacionadaAoSaintsai=v=>Boolean(module.exports.shortConversation.kind(v))||shortConversationScopeBase(v);\nmodule.exports.MASTER+='\\n'+module.exports.shortConversation.GUIDANCE;\nmodule.exports.STYLE+='\\n'+module.exports.shortConversation.GUIDANCE;\n`;
fs.writeFileSync(prompt,s);
const seller='src/services/salesSeller.service.js';
fs.writeFileSync(seller,fs.readFileSync(seller,'utf8').replaceAll('  if(recusou(pergunta)){',"  if(require('./ownerSalesPrompt').recusou(pergunta)){"));
edit(seller,'const styleExamples=[];const historico=await buscarHistorico(lojaId,contato,styleExamples);',`const styleExamples=[];const historico=await buscarHistorico(lojaId,contato,styleExamples);
  const shortPolicy=require('./ownerSalesPrompt').shortConversation;const shortTurn=shortPolicy?.kind(pergunta)==='clarify'?null:shortPolicy?.owner(pergunta,historico);if(shortTurn)return filtrarAntiFlood(lojaId,contato,shortTurn);`);
const tenant='src/services/tenantDialogue.service.js';s=fs.readFileSync(tenant,'utf8');if(!s.includes('shortConversationTenantBase'))s+=`\nconst tenantShortConversation=${inline};const shortConversationTenantBase=module.exports.fallback;module.exports.fallback=(question,history)=>shortConversationTenantBase(question,history)||tenantShortConversation.tenant(question,history);module.exports.shortGuidance=tenantShortConversation.GUIDANCE;\n`;fs.writeFileSync(tenant,s);
edit('src/services/iaPrompt.service.js',"systemPrompt: montarSystemPrompt(promptMestreLoja)+","systemPrompt: montarSystemPrompt(promptMestreLoja)+'\\n'+require('./tenantDialogue.service').shortGuidance+");
for(const f of [prompt,seller,tenant,'src/services/iaPrompt.service.js'])new(require('node:vm').Script)(fs.readFileSync(f,'utf8'));
console.log('Short conversation lab: scoped refusal, terse turns and respectful stops for owner and tenant');
