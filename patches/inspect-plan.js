const fs=require('node:fs');
for(const p of ['src/controllers/admin.controller.js','src/routes/admin.routes.js','public/plano.html','public/js/plano.js']){
 if(fs.existsSync(p)) console.log('[plan-inspect]',p,'\n'+fs.readFileSync(p,'utf8'));
}