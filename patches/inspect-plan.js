const fs=require('node:fs');
for(const p of [
 'src/controllers/admin.controller.js',
 'src/routes/admin.routes.js',
 'public/plano.html',
 'public/js/plano.js',
 'src/services/asaas.service.js',
 'src/controllers/assinaturas.controller.js',
 'src/routes/assinaturas.routes.js',
 'src/controllers/asaas.controller.js',
 'src/routes/asaas.routes.js',
 'src/services/assinaturas.service.js'
]){
 if(fs.existsSync(p)) console.log('[plan-inspect]',p,'\n'+fs.readFileSync(p,'utf8'));
}
