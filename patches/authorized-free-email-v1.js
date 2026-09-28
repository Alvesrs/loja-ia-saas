const fs=require('node:fs');
const cp=require('node:child_process');

function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

const controller='src/controllers/compraPublica.controller.js';
let c=read(controller);

if(!c.includes('function emailAutorizadoSaintsAI')){
  const anchor="function precoLink(c){return Math.ceil((Number(c||0)*1.20)/100)*100;}";
  if(!c.includes(anchor))throw new Error('Anchor precoLink não encontrado');
  c=c.replace(anchor,anchor+"\nfunction emailAutorizadoSaintsAI(email){const alvo=String(email||'').trim().toLowerCase();const lista=String(process.env.SAINTSAI_AUTHORIZED_FREE_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);return lista.includes(alvo);}");
}

const oldPlano="  const plano=listarPlanos().find(p=>p.codigo===planoCodigo&&p.vendavel&&p.precoMensalCentavos);";
if(!c.includes(oldPlano))throw new Error('Seleção de plano não encontrada');
c=c.replace(oldPlano,oldPlano+"\n  const autorizado=emailAutorizadoSaintsAI(email);");

c=c.replace(
  "  if(!plano)return res.status(400).json({erro:'Escolha um plano válido.'});\n  if(![1,3,6,12].includes(duracaoMeses))return res.status(400).json({erro:'Escolha uma duração válida.'});",
  "  if(!autorizado&&!plano)return res.status(400).json({erro:'Escolha um plano válido.'});\n  if(!autorizado&&![1,3,6,12].includes(duracaoMeses))return res.status(400).json({erro:'Escolha uma duração válida.'});"
);

const oldFlow="    await definirAssinatura(lojaId,{plano:'trial',status:'inativo',valido_ate:null});\n    const pix=await criarPixCompraPublica({lojaId,planoCodigo,duracaoMeses});\n\n    return res.status(201).json({\n      ok:true,\n      loja:{id:lojaId,nome},\n      conta:{email},\n      plano:{codigo:plano.codigo,nome:plano.nome,preco_mensal_centavos:precoLink(plano.precoMensalCentavos)},\n      pix,\n      login_url:'/painel/login.html'\n    });";
if(!c.includes(oldFlow))throw new Error('Fluxo de compra pública esperado não encontrado');
const newFlow="    if(autorizado){\n      await definirAssinatura(lojaId,{plano:'ilimitado',status:'ativo',valido_ate:null});\n      return res.status(201).json({ok:true,autorizada:true,loja:{id:lojaId,nome},conta:{email},plano:{codigo:'ilimitado',nome:'Ilimitado',preco_mensal_centavos:0},pix:null,login_url:'/cliente/cliente-login.html'});\n    }\n    await definirAssinatura(lojaId,{plano:'trial',status:'inativo',valido_ate:null});\n    const pix=await criarPixCompraPublica({lojaId,planoCodigo,duracaoMeses});\n\n    return res.status(201).json({\n      ok:true,\n      loja:{id:lojaId,nome},\n      conta:{email},\n      plano:{codigo:plano.codigo,nome:plano.nome,preco_mensal_centavos:precoLink(plano.precoMensalCentavos)},\n      pix,\n      login_url:'/cliente/cliente-login.html'\n    });";
c=c.replace(oldFlow,newFlow);
write(controller,c);

let html=read('public/comprar.html');

const oldStatus="$('status').textContent='Conta criada. Agora faça o pagamento para ativar o plano.';$('pix').classList.add('show');$('pixvalor').textContent=x.plano.nome+' · '+money(x.pix.valor_centavos);$('copiacola').value=x.pix.pix_copia_cola||'';if(x.pix.qr_code_base64)$('qr').src=x.pix.qr_code_base64.startsWith('data:')?x.pix.qr_code_base64:'data:image/png;base64,'+x.pix.qr_code_base64;else $('qr').style.display='none';$('pix').scrollIntoView({behavior:'smooth'});";
if(!html.includes(oldStatus))throw new Error('Fluxo Pix da tela pública não encontrado');
const newStatus="if(x.autorizada){$('status').className='status success';$('status').textContent='Conta autorizada criada. Nenhum pagamento é necessário.';$('pix').classList.remove('show');setTimeout(()=>{location.href=x.login_url||'/cliente/cliente-login.html';},900);return;}$('status').textContent='Conta criada. Agora faça o pagamento para ativar o plano.';$('pix').classList.add('show');$('pixvalor').textContent=x.plano.nome+' · '+money(x.pix.valor_centavos);$('copiacola').value=x.pix.pix_copia_cola||'';if(x.pix.qr_code_base64)$('qr').src=x.pix.qr_code_base64.startsWith('data:')?x.pix.qr_code_base64:'data:image/png;base64,'+x.pix.qr_code_base64;else $('qr').style.display='none';$('pix').scrollIntoView({behavior:'smooth'});";
html=html.replace(oldStatus,newStatus);
write('public/comprar.html',html);

cp.execFileSync(process.execPath,['--check',controller],{stdio:'inherit'});
if(!read(controller).includes("plano:'ilimitado',status:'ativo',valido_ate:null"))throw new Error('Plano autorizado não aplicado');
if(!read('public/comprar.html').includes('Conta autorizada criada. Nenhum pagamento é necessário.'))throw new Error('UI autorizada não aplicada');
console.log('[authorized-free-email-v1] PASS bypass de pagamento por allowlist de e-mail aplicado.');
