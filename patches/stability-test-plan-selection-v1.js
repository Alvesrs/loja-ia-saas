'use strict';const fs=require('node:fs');
for(const p of ['src/services/ownerSubscriptionTest.service.js','patches/assets/owner-subscription-test.service.js']){
 let s=fs.readFileSync(p,'utf8');if(s.includes('if(menuRequest&&!requested)'))continue;
 const declaration=" const requested=plans(flow).find(p=>t==='testeplano:'+p.codigo||t===p.codigo||t===norm(p.nome)||t==='plano '+p.codigo);";
 if(!s.includes(declaration)||!s.includes(' const menuRequest=')||!s.includes('if(menuRequest)return'))throw Error('Test plan selection anchor missing');
 s=s.replace(declaration+'\n','').replace(' const menuRequest=',declaration+'\n const menuRequest=').replace('if(menuRequest)return','if(menuRequest&&!requested)return');fs.writeFileSync(p,s);
}
