'use strict';
const fs=require('node:fs');
fs.copyFileSync('patches/assets/ownerAvailabilityReply.service.js','src/services/ownerAvailabilityReply.service.js');
const file='src/services/ownerSalesAutomation.service.js';let s=fs.readFileSync(file,'utf8');
if(!s.includes('availabilityReplyBase'))s+=`\nconst availabilityReplyBase=module.exports.analisar;module.exports.analisar=async args=>{const result=await availabilityReplyBase(args);if(result?.silencio||result?.resposta)return result;if(!/livre|dispon[ií]ve|agenda aberta|vagas/i.test(String(args.pergunta||'')))return result;const bridge=require('./ownerAvailabilityReply.service');if(!bridge.announcement(args.pergunta))return result;return await bridge.analisar(args)||result;};\n`;
fs.writeFileSync(file,s);console.log('Active owner prospects can acknowledge availability announcements once, preserving automatic-wait silence');
