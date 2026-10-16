'use strict';
const fs=require('node:fs');
fs.copyFileSync('patches/assets/pix-copy-link.service.js','src/services/pixCopyLink.service.js');
fs.mkdirSync('public/pix/copiar',{recursive:true});
fs.copyFileSync('patches/assets/pix-copy-page.html','public/pix/copiar/index.html');
const p='src/services/whatsappEnvio.service.js';let s=fs.readFileSync(p,'utf8');
const anchor='texto: resposta.resposta,';
if(!s.includes(anchor))throw Error('Pix send anchor missing');
s=s.replace(anchor,"texto: require('./pixCopyLink.service').message(resposta.resposta),");fs.writeFileSync(p,s);
