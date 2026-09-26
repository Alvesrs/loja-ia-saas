const fs=require('node:fs');
const cp=require('node:child_process');

function write(p,s){fs.writeFileSync(p,s);}
function read(p){return fs.readFileSync(p,'utf8');}

// 1) Cobrança pública: mesmo plano básico, mas R$120/mês quando comprado pelo link.
let asaas=read('src/services/asaas.service.js');
if(!asaas.includes('async function criarPixCompraPublica')){
  const anchor='function processarEventoAsaas(';
  if(!asaas.includes(anchor)) throw new Error('Ponto Asaas não encontrado');
  const fn=`
async function criarPixCompraPublica({ lojaId, duracaoMeses }) {
  if (!configurado()) throw new Error('asaas_nao_configurado');
  const meses = Number(duracaoMeses);
  if (![1,3,6,12].includes(meses)) throw new Error('duracao_invalida');

  const chavePix = await obterChavePixAtiva();
  if (!chavePix) throw new Error('pix_chave_ausente');

  const planoCodigo = 'basico';
  const precoMensalCentavos = 12000;
  const valorCentavos = precoMensalCentavos * meses;
  const externalReference = \`loja:\${lojaId}|plano:\${planoCodigo}|meses:\${meses}|canal:link|v:pix1\`;
  const payload = {
    addressKey: chavePix,
    description: \`SaintsAI - Básico Online - \${meses} mes(es)\`,
    value: Number((valorCentavos / 100).toFixed(2)),
    format: 'ALL',
    expirationSeconds: 86400,
    allowsMultiplePayments: false,
    externalReference,
  };

  const qr = await chamarAsaas('/v3/pix/qrCodes/static', { method:'POST', body:JSON.stringify(payload) });
  if (!qr?.id || !qr?.payload) throw new Error('asaas_resposta_invalida');

  const { error } = await supabase.from('cobrancas_assinaturas').insert({
    loja_id: lojaId,
    plano: planoCodigo,
    provedor: 'asaas',
    provider_checkout_id: String(qr.id),
    provider_assinatura_id: null,
    status_provider: 'PIX_AGUARDANDO',
    checkout_url: null,
    payer_email: null,
    external_reference: externalReference,
    atualizado_em: new Date().toISOString(),
  });
  if (error) throw error;

  return {
    tipo:'pix',
    provider_qr_id:String(qr.id),
    pix_copia_cola:String(qr.payload),
    qr_code_base64:qr.encodedImage ? String(qr.encodedImage) : null,
    expira_em:qr.expirationDate || null,
    duracao_meses:meses,
    valor_centavos:valorCentavos,
    preco_mensal_centavos:precoMensalCentavos,
    ambiente:ambiente(),
  };
}
`;
  asaas=asaas.replace(anchor,fn+'\n'+anchor);
}
if(!asaas.includes('criarPixCompraPublica,')){
  asaas=asaas.replace('  criarPixPlano,\n  processarEventoAsaas,','  criarPixPlano,\n  criarPixCompraPublica,\n  processarEventoAsaas,');
}
write('src/services/asaas.service.js',asaas);

// 2) Controller público de cadastro + pagamento.
write('src/controllers/compraPublica.controller.js', `
const supabase=require('../config/supabase');
const supabaseAuth=require('../config/supabaseAuth');
const {definirAssinatura}=require('../services/assinaturas.service');
const {criarPixCompraPublica}=require('../services/asaas.service');

function emailValido(v){return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(v||''));}
function digitos(v){return String(v||'').replace(/\\D/g,'');}

async function comprar(req,res){
  const nome=String(req.body?.nome||'').trim();
  const email=String(req.body?.email||'').trim().toLowerCase();
  const senha=String(req.body?.senha||'');
  const whatsapp=digitos(req.body?.whatsapp);
  const duracaoMeses=Number(req.body?.duracao_meses||1);

  if(nome.length<2||nome.length>100)return res.status(400).json({erro:'Informe o nome da empresa.'});
  if(!emailValido(email)||email.length>254)return res.status(400).json({erro:'Informe um e-mail válido.'});
  if(senha.length<6||senha.length>128)return res.status(400).json({erro:'A senha precisa ter pelo menos 6 caracteres.'});
  if(whatsapp.length<10||whatsapp.length>15)return res.status(400).json({erro:'Informe um WhatsApp válido com DDD.'});
  if(![1,3,6,12].includes(duracaoMeses))return res.status(400).json({erro:'Escolha uma duração válida.'});

  let userId=null,lojaId=null;
  try{
    const {data:criado,error:erroUser}=await supabaseAuth.auth.admin.createUser({
      email,password:senha,email_confirm:true,
      app_metadata:{saintsai_managed:true,saintsai_self_service:true},
      user_metadata:{origem:'link_compra'}
    });
    if(erroUser||!criado?.user?.id){
      const msg=String(erroUser?.message||'');
      if(/already|registered|exists/i.test(msg))return res.status(409).json({erro:'Este e-mail já está cadastrado. Use o login existente.'});
      throw erroUser||new Error('falha_usuario');
    }
    userId=criado.user.id;

    const {data:loja,error:erroLoja}=await supabase.from('lojas').insert({
      dono_id:userId,nome,ativa:true,numero_dono_whatsapp:whatsapp
    }).select('id,nome').single();
    if(erroLoja||!loja?.id)throw erroLoja||new Error('falha_loja');
    lojaId=loja.id;

    await definirAssinatura(lojaId,{plano:'trial',status:'inativo',valido_ate:null});
    const pix=await criarPixCompraPublica({lojaId,duracaoMeses});

    return res.status(201).json({
      ok:true,
      loja:{id:lojaId,nome},
      conta:{email},
      plano:{codigo:'basico',nome:'Básico Online',preco_mensal_centavos:12000},
      pix,
      login_url:'/painel/login.html'
    });
  }catch(erro){
    console.error('[compra-publica] falha',erro?.message||erro);
    if(lojaId){try{await supabase.from('lojas').delete().eq('id',lojaId);}catch(_){}}
    if(userId){try{await supabaseAuth.auth.admin.deleteUser(userId);}catch(_){}}
    if(erro?.message==='asaas_nao_configurado')return res.status(503).json({erro:'Pagamento indisponível no momento.'});
    if(erro?.message==='pix_chave_ausente')return res.status(503).json({erro:'Pix indisponível no momento.'});
    return res.status(500).json({erro:'Não foi possível concluir o cadastro agora.'});
  }
}

module.exports={comprar};
`);

write('src/routes/compraPublica.routes.js', `
const express=require('express');
const controller=require('../controllers/compraPublica.controller');
const router=express.Router();

const tentativas=new Map();
router.post('/',(req,res,next)=>{
  const ip=String(req.ip||req.socket?.remoteAddress||'');
  const agora=Date.now();
  const item=tentativas.get(ip)||{inicio:agora,total:0};
  if(agora-item.inicio>60*60*1000){item.inicio=agora;item.total=0;}
  item.total++;tentativas.set(ip,item);
  if(item.total>8)return res.status(429).json({erro:'Muitas tentativas. Aguarde um pouco e tente novamente.'});
  next();
},controller.comprar);

module.exports=router;
`);

// 3) Monta a rota pública.
let app=read('src/app.js');
if(!app.includes("const compraPublicaRoutes = require('./routes/compraPublica.routes');")){
  app=app.replace(
    "const whatsappWahaWebhookRoutes = require('./routes/whatsappWahaWebhook.routes');",
    "const whatsappWahaWebhookRoutes = require('./routes/whatsappWahaWebhook.routes');\nconst compraPublicaRoutes = require('./routes/compraPublica.routes');"
  );
}
if(!app.includes("app.use('/api/public/compra-saintsai', compraPublicaRoutes);")){
  app=app.replace(
    "app.use('/api/webhooks/waha', whatsappWahaWebhookRoutes);",
    "app.use('/api/webhooks/waha', whatsappWahaWebhookRoutes);\napp.use('/api/public/compra-saintsai', compraPublicaRoutes);"
  );
}
write('src/app.js',app);

// 4) Página de compra.
write('public/comprar.html', `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#09070f">
<title>Comprar SaintsAI</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;background:radial-gradient(circle at top,#24103c 0,#0b0811 42%,#07070a 100%);color:#f5f2ff;min-height:100vh}.wrap{width:min(100%,760px);margin:auto;padding:28px 18px 60px}.brand{text-align:center;margin:10px 0 28px}.brand b{font-size:34px;letter-spacing:-1px}.brand b span{color:#a855f7}.brand p{color:#b9adc9;margin:8px 0 0}.card{background:rgba(19,14,28,.92);border:1px solid #322442;border-radius:24px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.35);margin-bottom:16px}.plan{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.plan h1{font-size:22px;margin:0 0 6px}.muted{color:#b9adc9}.price{text-align:right;white-space:nowrap}.price strong{font-size:30px;color:#c084fc}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field{display:flex;flex-direction:column;gap:7px}.field.full{grid-column:1/-1}label{font-size:13px;color:#cfc4dd}input,select{width:100%;border:1px solid #3d2c50;background:#0e0b14;color:#fff;border-radius:12px;padding:13px 14px;font-size:16px;outline:none}input:focus,select:focus{border-color:#a855f7;box-shadow:0 0 0 3px rgba(168,85,247,.12)}button{width:100%;border:0;border-radius:14px;padding:14px 18px;font-weight:800;font-size:16px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;cursor:pointer;margin-top:16px}button:disabled{opacity:.55}.features{display:grid;gap:8px;margin-top:14px;color:#d8cee5;font-size:14px}.status{margin-top:14px;min-height:22px;color:#d8cee5}.erro{color:#fca5a5}.pix{display:none;text-align:center}.pix.show{display:block}.pix img{max-width:260px;width:100%;background:white;padding:10px;border-radius:16px}.pix textarea{width:100%;min-height:110px;margin-top:12px;background:#0e0b14;color:#ddd;border:1px solid #3d2c50;border-radius:12px;padding:12px}.success{color:#86efac;font-weight:700}@media(max-width:620px){.grid{grid-template-columns:1fr}.field.full{grid-column:auto}.plan{flex-direction:column}.price{text-align:left}}
</style>
</head>
<body><main class="wrap">
  <div class="brand"><b>Saints<span>AI</span></b><p>Atendimento inteligente para WhatsApp</p></div>

  <section class="card plan">
    <div><h1>Plano Básico Online</h1><div class="muted">Cadastro direto pelo link, pagamento via Pix e ativação automática.</div>
      <div class="features"><span>✓ Atendimento inteligente no WhatsApp</span><span>✓ Configuração do negócio e catálogo</span><span>✓ Painel do cliente</span></div>
    </div>
    <div class="price"><strong>R$ 120</strong><div class="muted">por mês</div></div>
  </section>

  <section class="card" id="cadastro">
    <h2 style="margin-top:0">Crie sua conta</h2>
    <form id="form">
      <div class="grid">
        <div class="field full"><label>Nome da empresa</label><input id="nome" maxlength="100" required></div>
        <div class="field"><label>E-mail</label><input id="email" type="email" maxlength="254" required></div>
        <div class="field"><label>WhatsApp com DDD</label><input id="whatsapp" inputmode="tel" maxlength="20" placeholder="43999999999" required></div>
        <div class="field"><label>Crie uma senha</label><input id="senha" type="password" minlength="6" maxlength="128" required></div>
        <div class="field"><label>Duração</label><select id="duracao"><option value="1">1 mês — R$ 120</option><option value="3">3 meses — R$ 360</option><option value="6">6 meses — R$ 720</option><option value="12">12 meses — R$ 1.440</option></select></div>
      </div>
      <button id="comprar" type="submit">Criar conta e gerar Pix</button>
      <div id="status" class="status"></div>
    </form>
  </section>

  <section class="card pix" id="pix">
    <h2>Pagamento via Pix</h2>
    <p id="pixvalor" class="success"></p>
    <img id="qr" alt="QR Code Pix">
    <textarea id="copiacola" readonly></textarea>
    <button id="copiar" type="button">Copiar Pix copia e cola</button>
    <p class="muted">Assim que o pagamento for confirmado, o plano é ativado automaticamente. Depois, entre no painel com o e-mail e senha cadastrados.</p>
    <button id="entrar" type="button">Ir para o login</button>
  </section>
</main>
<script>
const $=id=>document.getElementById(id);
$('form').addEventListener('submit',async e=>{
 e.preventDefault();const b=$('comprar');b.disabled=true;$('status').className='status';$('status').textContent='Criando sua conta e gerando o Pix…';
 try{
  const r=await fetch('/api/public/compra-saintsai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   nome:$('nome').value,email:$('email').value,senha:$('senha').value,whatsapp:$('whatsapp').value,duracao_meses:Number($('duracao').value)
  })});
  const x=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(x.erro||'Não foi possível concluir o cadastro.');
  $('status').textContent='Conta criada. Agora faça o pagamento para ativar o plano.';
  $('pix').classList.add('show');
  $('pixvalor').textContent='Valor: '+((x.pix.valor_centavos||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  $('copiacola').value=x.pix.pix_copia_cola||'';
  if(x.pix.qr_code_base64)$('qr').src=x.pix.qr_code_base64.startsWith('data:')?x.pix.qr_code_base64:'data:image/png;base64,'+x.pix.qr_code_base64;else $('qr').style.display='none';
  $('pix').scrollIntoView({behavior:'smooth'});
 }catch(err){$('status').className='status erro';$('status').textContent=err.message||'Erro ao concluir cadastro.';}finally{b.disabled=false;}
});
$('copiar').onclick=async()=>{try{await navigator.clipboard.writeText($('copiacola').value);$('copiar').textContent='Pix copiado ✓';}catch(_){$('copiacola').select();}};
$('entrar').onclick=()=>location.href='/painel/login.html';
</script>
</body></html>`);

cp.execFileSync(process.execPath,['--check','src/controllers/compraPublica.controller.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','src/routes/compraPublica.routes.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','src/services/asaas.service.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','src/app.js'],{stdio:'inherit'});
console.log('Link público de compra SaintsAI aplicado: R$120/mês.');
