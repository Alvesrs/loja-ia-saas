const fs=require('node:fs');
const path=require('node:path');
function walk(dir,out=[]){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) walk(p,out);
    else if(/\.(js|html)$/.test(e.name)) out.push(p);
  }
  return out;
}
for(const p of [...walk('src'),...walk('public')]){
  const s=fs.readFileSync(p,'utf8');
  const i=s.indexOf('prompt-mestre');
  if(i>=0) console.log('[prompt-master-inspect]',p,'\n'+s.slice(Math.max(0,i-1200),i+2200));
}

{
  const p='public/js/atendente.js';
  if(fs.existsSync(p)){
    const s=fs.readFileSync(p,'utf8');
    let pos=0, n=0;
    while((pos=s.indexOf('prompt-mestre',pos))>=0 && n<12){
      console.log('[prompt-save-inspect]',n,'\n'+s.slice(Math.max(0,pos-1000),pos+1800));
      pos+=12; n++;
    }
  }
}
