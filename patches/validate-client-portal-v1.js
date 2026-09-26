const fs=require('node:fs');
const cp=require('node:child_process');
const os=require('node:os');
const path=require('node:path');

const file='public/cliente-central.html';
const html=fs.readFileSync(file,'utf8');

const required=[
  'SAINTSAI_CLIENT_UI_V2',
  'SAINTSAI_ONBOARDING_V1',
  'id="onboarding-real"',
  'function trocar(',
  'async function carregar(',
  'async function carregarOnboarding('
];
for(const marker of required){
  if(!html.includes(marker)) throw new Error('Portal cliente incompleto: '+marker);
}

const re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
let m,i=0;
while((m=re.exec(html))){
  const code=m[1].trim();
  if(!code)continue;
  const tmp=path.join(os.tmpdir(),'saintsai-client-inline-'+(++i)+'.js');
  fs.writeFileSync(tmp,code);
  try{
    cp.execFileSync(process.execPath,['--check',tmp],{stdio:'inherit'});
  }finally{
    try{fs.unlinkSync(tmp)}catch(_){}
  }
}
if(i===0) throw new Error('Nenhum script inline encontrado no portal cliente.');

if(html.includes('await const ')) throw new Error('JavaScript inválido detectado: await const');

const ids=new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map(m=>m[1]));
const refs=new Set();
for(const m of html.matchAll(/\$\(['"]([^"']+)['"]\)/g)) refs.add(m[1]);
for(const m of html.matchAll(/getElementById\(['"]([^"']+)['"]\)/g)) refs.add(m[1]);
const faltando=[...refs].filter(id=>!ids.has(id));
if(faltando.length) throw new Error('Elementos ausentes usados pelo JavaScript: '+faltando.join(', '));
console.log('Portal cliente validado: UI, onboarding e '+i+' script(s) inline sem erro de sintaxe.');
