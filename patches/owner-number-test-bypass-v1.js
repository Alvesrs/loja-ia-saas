const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

write('src/services/ownerTest.service.js',[
"const supabase=require('../config/supabase');",
"const SAINTSAI_OWNER_STORE_ID='d9244132-557c-4603-986e-76897d449ab6';",
"function digitos(v){return String(v||'').replace(/\\D/g,'');}",
"async function ehNumeroDono(numero){",
"  const n=digitos(numero); if(!n)return false;",
"  const {data,error}=await supabase.from('lojas').select('numero_dono_whatsapp').eq('id',SAINTSAI_OWNER_STORE_ID).maybeSingle();",
"  if(error)throw error;",
"  const dono=digitos(data&&data.numero_dono_whatsapp);",
"  if(!dono)return false;",
"  return n===dono || (n.length>=10&&dono.length>=10&&n.slice(-11)===dono.slice(-11));",
"}",
"module.exports={ehNumeroDono};"
].join('\n'));

const cPath='src/controllers/compraPublica.controller.js';
let c=read(cPath);
if(!c.includes("const {ehNumeroDono}=require('../services/ownerTest.service');")){
  c=c.replace("const {listarPlanos}=require('../config/planos');","const {listarPlanos}=require('../config/planos');\nconst {ehNumeroDono}=require('../services/ownerTest.service');");
}
const old="    await definirAssinatura(lojaId,{plano:'trial',status:'inativo',valido_ate:null});\n    const pix=await criarPixCompraPublica({lojaId,planoCodigo,duracaoMeses});\n\n    return res.status(201).json({\n      ok:true,\n      loja:{id:lojaId,nome},\n      conta:{email},\n      plano:{codigo:plano.codigo,nome:plano.nome,preco_mensal_centavos:precoLink(plano.precoMensalCentavos)},\n      pix,\n      login_url:'/painel/login.html'\n    });";
const neu=[
"    const testeDono=await ehNumeroDono(whatsapp);",
"    if(testeDono){",
"      const validoAte=new Date(); validoAte.setUTCMonth(validoAte.getUTCMonth()+duracaoMeses);",
"      await definirAssinatura(lojaId,{plano:plano.codigo,status:'ativo',valido_ate:validoAte.toISOString()});",
"      return res.status(201).json({ok:true,modo_teste_dono:true,loja:{id:lojaId,nome},conta:{email},plano:{codigo:plano.codigo,nome:plano.nome,preco_mensal_centavos:0},pix:null,login_url:'/painel/login.html'});",
"    }",
"    await definirAssinatura(lojaId,{plano:'trial',status:'inativo',valido_ate:null});",
"    const pix=await criarPixCompraPublica({lojaId,planoCodigo,duracaoMeses});",
"    return res.status(201).json({ok:true,loja:{id:lojaId,nome},conta:{email},plano:{codigo:plano.codigo,nome:plano.nome,preco_mensal_centavos:precoLink(plano.precoMensalCentavos)},pix,login_url:'/painel/login.html'});"
].join('\n');
if(!c.includes('modo_teste_dono')){if(!c.includes(old))throw new Error('Fluxo público esperado não encontrado');c=c.replace(old,neu);}
write(cPath,c);

const hPath='public/comprar.html';
let h=read(hPath);
if(!h.includes('modo_teste_dono')){
  const oldJs="if(!r.ok)throw new Error(x.erro||'Não foi possível concluir o cadastro.');$('status').textContent='Conta criada. Agora faça o pagamento para ativar o plano.';$('pix').classList.add('show');$('pixvalor').textContent=x.plano.nome+' · '+money(x.pix.valor_centavos);$('copiacola').value=x.pix.pix_copia_cola||'';if(x.pix.qr_code_base64)$('qr').src=x.pix.qr_code_base64.startsWith('data:')?x.pix.qr_code_base64:'data:image/png;base64,'+x.pix.qr_code_base64;else $('qr').style.display='none';$('pix').scrollIntoView({behavior:'smooth'});";
  const newJs="if(!r.ok)throw new Error(x.erro||'Não foi possível concluir o cadastro.');if(x.modo_teste_dono){$('status').textContent='Número do dono reconhecido. Conta de teste ativada sem pagamento.';$('pix').classList.add('show');$('pix').querySelector('h2').textContent='Teste do dono ativado';$('pixvalor').textContent=x.plano.nome+' · sem pagamento';$('qr').style.display='none';$('copiacola').style.display='none';$('copiar').style.display='none';$('pix').querySelector('.muted').textContent='Esta compra foi reconhecida como teste do dono e o plano foi ativado automaticamente.';$('pix').scrollIntoView({behavior:'smooth'});return;}$('status').textContent='Conta criada. Agora faça o pagamento para ativar o plano.';$('pix').classList.add('show');$('pixvalor').textContent=x.plano.nome+' · '+money(x.pix.valor_centavos);$('copiacola').value=x.pix.pix_copia_cola||'';if(x.pix.qr_code_base64)$('qr').src=x.pix.qr_code_base64.startsWith('data:')?x.pix.qr_code_base64:'data:image/png;base64,'+x.pix.qr_code_base64;else $('qr').style.display='none';$('pix').scrollIntoView({behavior:'smooth'});";
  if(!h.includes(oldJs))throw new Error('Trecho do checkout público não encontrado');
  h=h.replace(oldJs,newJs);
}
write(hPath,h);

cp.execFileSync(process.execPath,['--check','src/services/ownerTest.service.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check',cPath],{stdio:'inherit'});
console.log('Bypass de pagamento para número do dono aplicado ao checkout público.');