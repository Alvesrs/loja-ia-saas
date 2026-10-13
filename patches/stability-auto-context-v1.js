'use strict';
const fs=require('node:fs');
const file='src/services/ownerSalesAutomation.service.js';
const from="return {silencio:true};\n \n  if(automatica||foraDoEscopo(pergunta))return {silencio:true};";
const to="// A mensagem anterior automática não bloqueia perguntas comerciais humanas.\n  if(automatica||foraDoEscopo(pergunta))return {silencio:true};";
const source=fs.readFileSync(file,'utf8');
if(!source.includes(to)){
 if(!source.includes(from))throw Error('Automatic context anchor missing');
 fs.writeFileSync(file,source.replace(from,to));
}
