const fs=require('node:fs');
const targets=[
  'src/app.js',
  'src/routes/whatsappConfiguracao.routes.js',
  'src/controllers/whatsappConfiguracao.controller.js',
  'src/services/whatsappConfiguracao.service.js',
  'src/middlewares/auth.middleware.js',
  'src/middlewares/autenticacao.middleware.js',
  'src/config/supabase.js',
  'public/whatsapp.html',
  'public/js/whatsapp.js',
  'public/dashboard.html'
];
for (const p of targets){
  if(!fs.existsSync(p)){ console.log('\n[META_INSPECT_MISSING] '+p); continue; }
  const s=fs.readFileSync(p,'utf8');
  console.log('\n[META_INSPECT_BEGIN] '+p+'\n'+s.slice(0,24000)+'\n[META_INSPECT_END] '+p);
}
