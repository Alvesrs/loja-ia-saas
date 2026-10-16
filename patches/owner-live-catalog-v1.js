'use strict';
const fs=require('node:fs');
fs.copyFileSync('patches/assets/ownerLiveCatalog.service.js','src/services/ownerLiveCatalog.service.js');
const file='src/services/agentFeatureMenus.service.js';
let s=fs.readFileSync(file,'utf8');
if(!s.includes('ownerLiveCatalogBase'))s+=`\nconst ownerLiveCatalogBase=module.exports.tentar;module.exports.tentar=async evento=>{const live=require('./ownerLiveCatalog.service');const raw=require('./acoesWhatsapp.service').lerId(evento?.texto)||evento?.texto;if(live.topic(raw))return live.tentar(evento);return ownerLiveCatalogBase(evento);};\n`;
fs.writeFileSync(file,s);
console.log('Owner demo uses live tenant-scoped services, availability and optional payment previews');
