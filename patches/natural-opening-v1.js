'use strict';const fs=require('node:fs');
const p='src/services/ownerSalesPrompt.js';let s=fs.readFileSync(p,'utf8');
const intro='Oi! Aqui é do SaintsAI. É vc quem cuida do atendimento pelo WhatsApp?';
if(!/const INTRO\s*=/.test(s))throw Error('Opening anchor missing');
s=s.replace(/const INTRO\s*=\s*'[^'\n]*';/,'const INTRO='+JSON.stringify(intro)+';');
const neutral='Apresente o contato em nome do SaintsAI, sem anunciar ser IA ou assistente virtual na abertura e sem repetir apresentações. Não se passe por uma pessoa específica. Se perguntarem se é IA ou uma pessoa, explique com clareza que é o assistente virtual do SaintsAI.';
for(const old of ['Identifique-se como assistente virtual; não finja ser uma pessoa.','Identifique-se como IA; nunca finja ser uma pessoa.','Identifique-se como assistente virtual.'])s=s.replaceAll(old,neutral);
fs.writeFileSync(p,s);
const rules='src/services/autoProspect.rules.js';s=fs.readFileSync(rules,'utf8').replaceAll('Sou o Pedro, do SaintsAI.','Aqui é do SaintsAI.').replaceAll('Pedro, do SaintsAI, por aqui.','Aqui é do SaintsAI.');
if(!s.includes('&&/pedro/.test(t)'))throw Error('Automatic opening quality anchor missing');
s=s.replace('&&/pedro/.test(t)',"&&!/sou (?:o |a )?pedro|assistente virtual|sou (?:uma? )?ia/i.test(t)");fs.writeFileSync(rules,s);
const auto='src/services/autoProspect.service.js';s=fs.readFileSync(auto,'utf8');if(!s.includes('Identifique-se como Pedro, do SaintsAI.'))throw Error('Automatic opening prompt anchor missing');
s=s.replace('Identifique-se como Pedro, do SaintsAI.','Fale em nome do SaintsAI sem atribuir a mensagem a uma pessoa específica. Não abra anunciando ser assistente virtual ou IA.');fs.writeFileSync(auto,s);
for(const file of ['public/cliente-versao.json','public/admin-versao.json']){const v=JSON.parse(fs.readFileSync(file,'utf8'));v.versao='2026.10.15.19';v.novidades.unshift('Abertura curta de prospecção em nome do SaintsAI, sem apresentação automática como assistente virtual');fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n');}
for(const file of [p,rules,auto])new(require('node:vm').Script)(fs.readFileSync(file,'utf8'));
console.log('[natural-opening] aberturas manual e automática em nome do SaintsAI; identidade honesta quando perguntada');
