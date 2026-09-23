const fs=require('node:fs');
for(const p of ['public/js/components.js','public/js/layout.js','public/css/styles.css']){
 if(fs.existsSync(p)) console.log('[nav-inspect]',p,'\n'+fs.readFileSync(p,'utf8').slice(0,30000));
}