const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

const asaasPath='src/services/asaas.service.js';
let a=read(asaasPath);
const oldFn=/async function criarPixCompraPublica\(\{ lojaId, duracaoMeses \}\) \{[\s\S]*?\n\}/;
if(!oldFn.test(a)) throw new Error('criarPixCompraPublica atual não encontrado');
const newFn=`async function criarPixCompraPublica({ lojaId, planoCodigo, duracaoMeses }) {
  if (!configurado()) throw new Error('asaas_nao_configurado');
  const meses = Number(duracaoMeses);
  if (![1,3,6,12].includes(meses)) throw new Error('duracao_invalida');

  const plano = obterPlano(planoCodigo);
  if (!plano || !plano.vendavel || !plano.precoMensalCentavos) throw new Error('plano_nao_vendavel');

  const chavePix = await obterChavePixAtiva();
  if (!chavePix) throw new Error('pix_chave_ausente');

  // Link público custa 20% a mais que a venda direta.
  const precoMensalCentavos = Math.ceil((Number(plano.precoMensalCentavos) * 1.20) / 100) * 100;
  const valorCentavos = precoMensalCentavos * meses;
  const externalReference = \`loja:\${lojaId}|plano:\${plano.codigo}|meses:\${meses}|canal:link|v:pix1\`;
  const payload = {
    addressKey: chavePix,
    description: \`SaintsAI - \${plano.nome} Online - \${meses} mes(es)\`,
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
    plano: plano.codigo,
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
    plano:{codigo:plano.codigo,nome:plano.nome},
    ambiente:ambiente(),
  };
}`;
a=a.replace(oldFn,newFn);
write(asaasPath,a);

write('src/controllers/compraPublica.controller.js',`
const supabase=require('../config/supabase');
const supabaseAuth=require('../config/supabaseAuth');
const {definirAssinatura}=require('../services/assinaturas.service');
const {criarPixCompraPublica}=require('../services/asaas.service');
const {listarPlanos}=require('../config/planos');

function emailValido(v){return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(v||''));}
function digitos(v){return String(v||'').replace(/\\D/g,'');}
function precoLink(c){return Math.ceil((Number(c||0)*1.20)/100)*100;}

function listarPlanosPublicos(req,res){
  const planos=listarPlanos().filter(p=>p.vendavel&&p.precoMensalCentavos).map(p=>({
    codigo:p.codigo,
    nome:p.nome,
    limiteMensagensMes:p.limiteMensagensMes,
    preco_base_centavos:Number(p.precoMensalCentavos),
    preco_link_centavos:precoLink(p.precoMensalCentavos)
  }));
  return res.json({planos});
}

async function comprar(req,res){
  const nome=String(req.body?.nome||'').trim();
  const email=String(req.body?.email||'').trim().toLowerCase();
  const senha=String(req.body?.senha||'');
  const whatsapp=digitos(req.body?.whatsapp);
  const planoCodigo=String(req.body?.plano||'').trim();
  const duracaoMeses=Number(req.body?.duracao_meses||1);
  const plano=listarPlanos().find(p=>p.codigo===planoCodigo&&p.vendavel&&p.precoMensalCentavos);

  if(nome.length<2||nome.length>100)return res.status(400).json({erro:'Informe o nome da empresa.'});
  if(!emailValido(email)||email.length>254)return res.status(400).json({erro:'Informe um e-mail válido.'});
  if(senha.length<6||senha.length>128)return res.status(400).json({erro:'A senha precisa ter pelo menos 6 caracteres.'});
  if(whatsapp.length<10||whatsapp.length>15)return res.status(400).json({erro:'Informe um WhatsApp válido com DDD.'});
  if(!plano)return res.status(400).json({erro:'Escolha um plano válido.'});
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
    const pix=await criarPixCompraPublica({lojaId,planoCodigo,duracaoMeses});

    return res.status(201).json({
      ok:true,
      loja:{id:lojaId,nome},
      conta:{email},
      plano:{codigo:plano.codigo,nome:plano.nome,preco_mensal_centavos:precoLink(plano.precoMensalCentavos)},
      pix,
      login_url:'/painel/login.html'
    });
  }catch(erro){
    console.error('[compra-publica] falha',erro?.message||erro);
    if(lojaId){try{await supabase.from('lojas').delete().eq('id',lojaId);}catch(_){}}
    if(userId){try{await supabaseAuth.auth.admin.deleteUser(userId);}catch(_){}}
    if(erro?.message==='asaas_nao_configurado')return res.status(503).json({erro:'Pagamento indisponível no momento.'});
    if(erro?.message==='pix_chave_ausente')return res.status(503).json({erro:'Pix indisponível no momento.'});
    if(erro?.message==='plano_nao_vendavel')return res.status(400).json({erro:'Plano indisponível.'});
    return res.status(500).json({erro:'Não foi possível concluir o cadastro agora.'});
  }
}

module.exports={comprar,listarPlanosPublicos};
`);

write('src/routes/compraPublica.routes.js',`
const express=require('express');
const controller=require('../controllers/compraPublica.controller');
const router=express.Router();

router.get('/planos',controller.listarPlanosPublicos);

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

write('public/comprar.html',`<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#09070f"><title>Comprar SaintsAI</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;background:radial-gradient(circle at top,#24103c 0,#0b0811 42%,#07070a 100%);color:#f5f2ff;min-height:100vh}.wrap{width:min(100%,980px);margin:auto;padding:28px 18px 60px}.brand{text-align:center;margin:10px 0 28px}.brand b{font-size:34px}.brand b span{color:#a855f7}.brand p,.muted{color:#b9adc9}.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:18px}.plan{background:rgba(19,14,28,.92);border:1px solid #322442;border-radius:22px;padding:20px;cursor:pointer;transition:.15s}.plan:hover,.plan.sel{border-color:#a855f7;transform:translateY(-2px);box-shadow:0 0 0 2px rgba(168,85,247,.14)}.plan h2{margin:0 0 8px;font-size:20px}.price{font-size:30px;font-weight:800;color:#c084fc}.tag{font-size:12px;color:#b9adc9;margin-top:8px}.card{background:rgba(19,14,28,.92);border:1px solid #322442;border-radius:24px;padding:22px;margin-bottom:16px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field{display:flex;flex-direction:column;gap:7px}.field.full{grid-column:1/-1}label{font-size:13px;color:#cfc4dd}input,select{width:100%;border:1px solid #3d2c50;background:#0e0b14;color:#fff;border-radius:12px;padding:13px 14px;font-size:16px}button{width:100%;border:0;border-radius:14px;padding:14px 18px;font-weight:800;font-size:16px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;cursor:pointer;margin-top:16px}button:disabled{opacity:.55}.status{margin-top:14px;min-height:22px}.erro{color:#fca5a5}.pix{display:none;text-align:center}.pix.show{display:block}.pix img{max-width:260px;width:100%;background:white;padding:10px;border-radius:16px}.pix textarea{width:100%;min-height:110px;margin-top:12px;background:#0e0b14;color:#ddd;border:1px solid #3d2c50;border-radius:12px;padding:12px}.success{color:#86efac;font-weight:700}@media(max-width:760px){.plans{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.field.full{grid-column:auto}}
</style></head><body><main class="wrap">
<div class="brand"><b>Saints<span>AI</span></b><p>Escolha seu plano e faça tudo online.</p></div>
<section id="plans" class="plans"><div class="card">Carregando planos…</div></section>
<section class="card"><h2 style="margin-top:0">Crie sua conta</h2>
<form id="form"><div class="grid">
<div class="field full"><label>Nome da empresa</label><input id="nome" maxlength="100" required></div>
<div class="field"><label>E-mail</label><input id="email" type="email" maxlength="254" required></div>
<div class="field"><label>WhatsApp com DDD</label><input id="whatsapp" inputmode="tel" maxlength="20" required></div>
<div class="field"><label>Crie uma senha</label><input id="senha" type="password" minlength="6" maxlength="128" required></div>
<div class="field"><label>Duração</label><select id="duracao"><option value="1">1 mês</option><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option></select></div>
<div class="field"><label>Plano escolhido</label><input id="planoNome" readonly></div>
</div><button id="comprar" type="submit">Criar conta e gerar Pix</button><div id="status" class="status"></div></form>
</section>
<section class="card pix" id="pix"><h2>Pagamento via Pix</h2><p id="pixvalor" class="success"></p><img id="qr" alt="QR Code Pix"><textarea id="copiacola" readonly></textarea><button id="copiar" type="button">Copiar Pix copia e cola</button><p class="muted">Após a confirmação, o plano é ativado automaticamente.</p><button id="entrar" type="button">Ir para o login</button></section>
</main><script>
const $=id=>document.getElementById(id);let planos=[],selecionado=null;
function money(c){return (Number(c||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function limite(v){return v===null?'Mensagens ilimitadas':Number(v).toLocaleString('pt-BR')+' mensagens/mês';}
function selecionar(c){selecionado=planos.find(p=>p.codigo===c)||null;document.querySelectorAll('.plan').forEach(x=>x.classList.toggle('sel',x.dataset.codigo===c));$('planoNome').value=selecionado?selecionado.nome+' · '+money(selecionado.preco_link_centavos)+'/mês':'';}
async function carregar(){try{const r=await fetch('/api/public/compra-saintsai/planos');const x=await r.json();planos=x.planos||[];$('plans').innerHTML=planos.map(p=>'<article class="plan" data-codigo="'+p.codigo+'"><h2>'+p.nome+'</h2><div class="price">'+money(p.preco_link_centavos)+'</div><div class="muted">por mês</div><div class="tag">'+limite(p.limiteMensagensMes)+'</div></article>').join('');document.querySelectorAll('.plan').forEach(el=>el.onclick=()=>selecionar(el.dataset.codigo));if(planos[0])selecionar(planos[0].codigo);}catch(e){$('plans').innerHTML='<div class="card">Não foi possível carregar os planos.</div>';}}
$('form').addEventListener('submit',async e=>{e.preventDefault();if(!selecionado)return $('status').textContent='Escolha um plano.';const b=$('comprar');b.disabled=true;$('status').className='status';$('status').textContent='Criando sua conta e gerando o Pix…';try{const r=await fetch('/api/public/compra-saintsai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome:$('nome').value,email:$('email').value,senha:$('senha').value,whatsapp:$('whatsapp').value,plano:selecionado.codigo,duracao_meses:Number($('duracao').value)})});const x=await r.json().catch(()=>({}));if(!r.ok)throw new Error(x.erro||'Não foi possível concluir o cadastro.');$('status').textContent='Conta criada. Agora faça o pagamento para ativar o plano.';$('pix').classList.add('show');$('pixvalor').textContent=x.plano.nome+' · '+money(x.pix.valor_centavos);$('copiacola').value=x.pix.pix_copia_cola||'';if(x.pix.qr_code_base64)$('qr').src=x.pix.qr_code_base64.startsWith('data:')?x.pix.qr_code_base64:'data:image/png;base64,'+x.pix.qr_code_base64;else $('qr').style.display='none';$('pix').scrollIntoView({behavior:'smooth'});}catch(err){$('status').className='status erro';$('status').textContent=err.message||'Erro.';}finally{b.disabled=false;}});
$('copiar').onclick=async()=>{try{await navigator.clipboard.writeText($('copiacola').value);$('copiar').textContent='Pix copiado ✓';}catch(_){$('copiacola').select();}};$('entrar').onclick=()=>location.href='/painel/login.html';carregar();
</script></body></html>`);

cp.execFileSync(process.execPath,['--check',asaasPath],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','src/controllers/compraPublica.controller.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','src/routes/compraPublica.routes.js'],{stdio:'inherit'});
console.log('Compra pública atualizada para todos os planos vendáveis com adicional de 20%.');
