const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

const seller='src/services/salesSeller.service.js';
let s=read(seller);
const oldBlock="    if (texto(respostaLlm).toUpperCase() === '[SILENCIO]') return null;\n    return respostaLlm;";
const newBlock=[
"    const respostaTexto = texto(respostaLlm);",
"    const marcador = respostaTexto.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim().toUpperCase();",
"    const somenteControle = /^\\[[A-Z_ -]{3,32}\\]$/.test(marcador);",
"    const pareceSilencio = /SILEN|VILENCI|SILENC|SILENCE/.test(marcador);",
"    if (somenteControle || pareceSilencio) {",
"      console.log('[salesSeller] marcador_interno_bloqueado');",
"      return null;",
"    }",
"    return respostaTexto;"
].join('\n');
if(s.includes(oldBlock)) s=s.replace(oldBlock,newBlock);
else if(!s.includes('marcador_interno_bloqueado')) throw new Error('Trecho de silêncio do salesSeller não encontrado.');
write(seller,s);

const atend='src/services/whatsappAtendente.service.js';
let a=read(atend);
const alvo="    if (vendaAtiva && (resposta === null || resposta === undefined || String(resposta).trim() === '')) {";
if(a.includes(alvo) && !a.includes('controle_interno_descartado')){
  const defesa=[
"    if (vendaAtiva && typeof resposta === 'string') {",
"      const controleInterno = resposta.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim().toUpperCase();",
"      if (/^\\[[A-Z_ -]{3,32}\\]$/.test(controleInterno)) {",
"        console.log('[salesSeller] controle_interno_descartado', contato);",
"        return null;",
"      }",
"    }",
""
  ].join('\n');
  a=a.replace(alvo,defesa+alvo);
}
write(atend,a);

cp.execFileSync(process.execPath,['--check',seller],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check',atend],{stdio:'inherit'});
console.log('Marcadores internos de silêncio bloqueados antes do envio.');