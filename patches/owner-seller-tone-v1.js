const fs=require('node:fs');
const file='src/services/ownerFirstMessage.service.js';
let s=fs.readFileSync(file,'utf8');
const old='(data.prompt_mestre||MASTER):null';
if(!s.includes(old))throw Error('Owner seller prompt anchor missing');
s=s.replace(old,"(require('./ownerSalesPrompt').STYLE+'\\n'+(data.prompt_mestre||MASTER)):null");
fs.writeFileSync(file,s);
console.log('Owner seller conversational style enabled');
