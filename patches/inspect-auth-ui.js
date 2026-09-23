const fs=require('node:fs'),path=require('node:path');
function walk(d){if(!fs.existsSync(d))return[];return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name);return e.isDirectory()?walk(p):[p]});}
for(const p of walk('public')){
 if(!/\.(html|js)$/i.test(p)) continue;
 const s=fs.readFileSync(p,'utf8');
 if(/type=["']password["']|login|entrar|senha/i.test(s)){
   console.log('[auth-ui-inspect]',p,'\n'+s.slice(0,18000));
 }
}