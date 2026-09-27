const fs=require('node:fs');
const cp=require('node:child_process');
const p='src/controllers/clienteHub.controller.js';
let s=fs.readFileSync(p,'utf8');

const a=s.indexOf('async function criarServico(req,res){');
const b=s.indexOf('\nasync function atualizarServico(req,res){',a);
if(a<0||b<0)throw new Error('Função criarServico não encontrada');

let fn=s.slice(a,b);
if(!fn.includes('SAINTSAI_SERVICE_BODY_NORMALIZE_V1')){
  const anchor="    const loja=await exigirLoja(req,res); if(!loja)return;";
  if(!fn.includes(anchor))throw new Error('Anchor criarServico não encontrado');
  const insert=[
    anchor,
    '    // SAINTSAI_SERVICE_BODY_NORMALIZE_V1',
    '    let body=req.body;',
    "    for(let i=0;i<2&&typeof body==='string';i++){",
    '      try{body=JSON.parse(body);}catch(_){break;}',
    '    }',
    "    if(!body||typeof body!=='object'||Array.isArray(body))body={};"
  ].join('\n');
  fn=fn.replace(anchor,insert);
  fn=fn.replace(/req\.body/g,'body');
  fn=fn.replace('let body=body;','let body=req.body;');
  s=s.slice(0,a)+fn+s.slice(b);
}

fs.writeFileSync(p,s);
cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
console.log('Body do cadastro de serviço normalizado.');