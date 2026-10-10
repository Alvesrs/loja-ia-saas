const fs=require('node:fs');
fs.copyFileSync('patches/assets/galeriaBusca.helpers.js','src/services/galeriaBusca.helpers.js');
fs.copyFileSync('patches/assets/owner-lab-gallery.service.js','src/services/ownerLabGallery.service.js');
fs.copyFileSync('patches/assets/owner-product-lab.service.js','src/services/ownerProductLab.service.js');
let s=fs.readFileSync('src/services/whatsappAtendente.service.js','utf8');
s=s.replace('tryHandle({lojaId,contato,pergunta:texto})','tryHandle({lojaId,contato,configuracaoId:mensagem.configuracaoId,pergunta:texto})');
const a='resposta:lab.response,productLab:true';if(!s.includes(a))throw Error('lab media anchor missing');
s=s.replace(a,a+',...(lab.midias?.length?{midias:lab.midias}:{})');fs.writeFileSync('src/services/whatsappAtendente.service.js',s);
const p='src/services/whatsappEnvio.service.js';s=fs.readFileSync(p,'utf8');
if(!s.includes("require('./galeriaEnvio.service').enviar")){const a='async function enviarRespostaWhatsapp(mensagem, resposta, contexto) {\n  try {';if(!s.includes(a))throw Error('gallery send anchor missing');s=s.replace(a,a+"\n    if(Array.isArray(resposta?.midias))return await require('./galeriaEnvio.service').enviar(mensagem,resposta,contexto,enviarRespostaWhatsapp);");fs.writeFileSync(p,s);}
console.log('Galeria própria pode ser demonstrada por contatos verificados do laboratório.');
