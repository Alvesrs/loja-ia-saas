const fs=require('node:fs');
const files=['public/js/atendente.js','public/js/dashboard.js','public/js/loja.js','public/js/whatsapp.js','public/atendente.html','public/dashboard.html'];
for(const p of files){if(!fs.existsSync(p)) continue; const s=fs.readFileSync(p,'utf8'); const termos=['teste-guiado-status','progresso','checklist','whatsapp','prompt_mestre','prompt-mestre']; for(const t of termos){let i=s.indexOf(t); if(i>=0) console.log('[progress-inspect]',p,t,'\n'+s.slice(Math.max(0,i-1400),i+3200));}}
