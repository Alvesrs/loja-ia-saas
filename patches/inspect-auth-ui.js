const fs=require('node:fs');
const paths=['public/login.html','public/js/login.js','public/estoque/login.html','public/estoque/js/login.js','public/painel/login.html','public/painel/js/login.js'];
for(const p of paths){if(fs.existsSync(p)) console.log('[auth-ui-inspect]',p,'\n'+fs.readFileSync(p,'utf8'));}
