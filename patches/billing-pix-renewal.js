const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8');}
function write(p,s){fs.writeFileSync(p,s);}
function rep(p,a,b){
  const s=read(p);
  if(!s.includes(a)) throw new Error('Trecho esperado não encontrado em '+p+': '+a.slice(0,100));
  write(p,s.replace(a,b));
}

// ---------- Asaas: Pix por plano e duração ----------
let s=read('src/services/asaas.service.js');

s=s.replace(
`function parseExternalReference(ref) {
  const texto = String(ref || '');
  return {
    lojaId: /(?:^|\\|)loja:([^|]+)/.exec(texto)?.[1] || null,
    plano: /(?:^|\\|)plano:([^|]+)/.exec(texto)?.[1] || null,
  };
}`,
`function parseExternalReference(ref) {
  const texto = String(ref || '');
  const mesesRaw = Number(/(?:^|\\|)meses:([^|]+)/.exec(texto)?.[1] || 0);
  return {
    lojaId: /(?:^|\\|)loja:([^|]+)/.exec(texto)?.[1] || null,
    plano: /(?:^|\\|)plano:([^|]+)/.exec(texto)?.[1] || null,
    meses: [1,3,6,12].includes(mesesRaw) ? mesesRaw : null,
  };
}

function validadePorMeses(meses, agora = new Date()) {
  if (![1,3,6,12].includes(Number(meses))) return null;
  const d = new Date(agora);
  d.setUTCMonth(d.getUTCMonth() + Number(meses));
  return d.toISOString();
}

async function obterChavePixAtiva() {
  const lista = await chamarAsaas('/v3/pix/addressKeys?status=ACTIVE&limit=20', { method:'GET' });
  const itens = Array.isArray(lista?.data) ? lista.data : [];
  const ativa = itens.find((item) => String(item?.status || '').toUpperCase() === 'ACTIVE' && item?.key);
  return ativa?.key ? String(ativa.key) : null;
}

async function criarPixPlano({ lojaId, planoCodigo, duracaoMeses }) {
  if (!configurado()) throw new Error('asaas_nao_configurado');
  const plano = obterPlano(planoCodigo);
  if (!plano || !plano.vendavel) throw new Error('plano_nao_vendavel');
  if (!plano.precoMensalCentavos) throw new Error('preco_nao_configurado');

  const meses = Number(duracaoMeses);
  if (![1,3,6,12].includes(meses)) throw new Error('duracao_invalida');

  const chavePix = await obterChavePixAtiva();
  if (!chavePix) throw new Error('pix_chave_ausente');

  const externalReference = \`loja:\${lojaId}|plano:\${planoCodigo}|meses:\${meses}|v:pix1\`;
  const valorCentavos = plano.precoMensalCentavos * meses;
  const payload = {
    addressKey: chavePix,
    description: \`SaintsAI - \${plano.nome} - \${meses} mes(es)\`,
    value: Number((valorCentavos / 100).toFixed(2)),
    format: 'ALL',
    expirationSeconds: 86400,
    allowsMultiplePayments: false,
    externalReference,
  };

  const qr = await chamarAsaas('/v3/pix/qrCodes/static', { method:'POST', body:JSON.stringify(payload) });
  if (!qr?.id || !qr?.payload) throw new Error('asaas_resposta_invalida');

  const qrId = String(qr.id);
  const { error } = await supabase.from('cobrancas_assinaturas').insert({
    loja_id: lojaId,
    plano: planoCodigo,
    provedor: 'asaas',
    provider_checkout_id: qrId,
    provider_assinatura_id: null,
    status_provider: 'PIX_AGUARDANDO',
    checkout_url: null,
    payer_email: null,
    external_reference: externalReference,
    atualizado_em: new Date().toISOString(),
  });
  if (error) throw error;

  return {
    tipo: 'pix',
    provider_qr_id: qrId,
    pix_copia_cola: String(qr.payload),
    qr_code_base64: qr.encodedImage ? String(qr.encodedImage) : null,
    expira_em: qr.expirationDate || null,
    duracao_meses: meses,
    valor_centavos: valorCentavos,
    ambiente: ambiente(),
  };
}`
);

s=s.replace(
`async function ativarPlano({ lojaId, plano, assinaturaId = null, providerStatus }) {
  return definirAssinatura(lojaId, {
    plano,
    status: 'ativo',
    valido_ate: null,
    provedor_pagamento: 'asaas',
    provider_assinatura_id: assinaturaId,
    provider_status: providerStatus || null,
  });
}`,
`async function ativarPlano({ lojaId, plano, assinaturaId = null, providerStatus, duracaoMeses = null }) {
  return definirAssinatura(lojaId, {
    plano,
    status: 'ativo',
    valido_ate: duracaoMeses ? validadePorMeses(duracaoMeses) : null,
    provedor_pagamento: 'asaas',
    provider_assinatura_id: assinaturaId,
    provider_status: providerStatus || null,
  });
}`
);

s=s.replace(
`  if (tipo.startsWith('PAYMENT_')) {
    const pagamento = payload?.payment || {};
    const assinaturaId = pagamento.subscription ? String(pagamento.subscription) : null;
    if (!assinaturaId) return { ignorado: true };
    const checkoutId = checkoutIdDoPagamento(pagamento);
    const ref = pagamento.externalReference ? String(pagamento.externalReference) : null;
    let cobranca = await localizarCobranca({ assinaturaId });
    if (!cobranca && checkoutId) cobranca = await localizarCobranca({ checkoutId });
    if (!cobranca && ref) cobranca = await localizarCobranca({ externalReference: ref });
    if (!cobranca) cobranca = await localizarCobrancaPorAssinaturaRemota(assinaturaId);
    if (!cobranca?.loja_id || !obterPlano(cobranca.plano)) return { ignorado: true };
    if (cobranca.id) await atualizarCobranca(cobranca.id, { provider_assinatura_id: assinaturaId, status_provider: tipo });

    if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(tipo)) {
      const assinatura = await ativarPlano({ lojaId: cobranca.loja_id, plano: cobranca.plano, assinaturaId, providerStatus: tipo });
      return { atualizado: true, assinatura };
    }`,
`  if (tipo.startsWith('PAYMENT_')) {
    const pagamento = payload?.payment || {};
    const assinaturaId = pagamento.subscription ? String(pagamento.subscription) : null;
    const pixQrCodeId = pagamento.pixQrCodeId ? String(pagamento.pixQrCodeId) : null;
    const checkoutId = checkoutIdDoPagamento(pagamento);
    const ref = pagamento.externalReference ? String(pagamento.externalReference) : null;

    let cobranca = null;
    if (pixQrCodeId) cobranca = await localizarCobranca({ checkoutId: pixQrCodeId });
    if (!cobranca && assinaturaId) cobranca = await localizarCobranca({ assinaturaId });
    if (!cobranca && checkoutId) cobranca = await localizarCobranca({ checkoutId });
    if (!cobranca && ref) cobranca = await localizarCobranca({ externalReference: ref });
    if (!cobranca && assinaturaId) cobranca = await localizarCobrancaPorAssinaturaRemota(assinaturaId);

    if (!cobranca?.loja_id || !obterPlano(cobranca.plano)) return { ignorado: true };
    const refDados = parseExternalReference(ref || cobranca.external_reference);

    if (cobranca.id) await atualizarCobranca(cobranca.id, {
      ...(assinaturaId ? { provider_assinatura_id: assinaturaId } : {}),
      status_provider: tipo
    });

    if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(tipo)) {
      const assinatura = await ativarPlano({
        lojaId: cobranca.loja_id,
        plano: cobranca.plano,
        assinaturaId,
        providerStatus: tipo,
        duracaoMeses: pixQrCodeId ? refDados.meses : null
      });
      return { atualizado: true, assinatura };
    }`
);

s=s.replace(
`  criarCheckoutAssinatura,
  processarEventoAsaas,`,
`  criarCheckoutAssinatura,
  criarPixPlano,
  processarEventoAsaas,`
);
write('src/services/asaas.service.js',s);

// ---------- Controller Asaas ----------
let ac=read('src/controllers/asaas.controller.js');
ac=ac.replace(
`const { criarCheckoutAssinatura, processarEventoAsaas, configurado, webhookConfigurado, webhookValido, ambiente } = require('../services/asaas.service');`,
`const { criarCheckoutAssinatura, criarPixPlano, processarEventoAsaas, configurado, webhookConfigurado, webhookValido, ambiente } = require('../services/asaas.service');`
);

if(!ac.includes('async function criarPix(req, res)')) {
  ac=ac.replace('\nfunction statusIntegracao(req, res) {', `
async function criarPix(req, res) {
  try {
    const plano = String(req.body?.plano || '').trim();
    const duracaoMeses = Number(req.body?.duracao_meses);
    const resultado = await criarPixPlano({ lojaId:req.params.lojaId, planoCodigo:plano, duracaoMeses });
    return res.status(201).json(resultado);
  } catch (erro) {
    if (erro.message === 'asaas_nao_configurado') return res.status(503).json({ erro:'Cobrança automática ainda não está configurada.' });
    if (erro.message === 'plano_nao_vendavel') return res.status(400).json({ erro:'Este plano não pode ser comprado.' });
    if (erro.message === 'preco_nao_configurado') return res.status(503).json({ erro:'O preço deste plano ainda não foi configurado.' });
    if (erro.message === 'duracao_invalida') return res.status(400).json({ erro:'Escolha uma duração válida.' });
    if (erro.message === 'pix_chave_ausente') return res.status(503).json({ erro:'Sua conta Asaas não possui uma chave Pix ativa.' });
    console.error('[asaas] falha ao criar Pix:', erro?.name || 'erro');
    return res.status(502).json({ erro:'Não foi possível gerar o Pix agora.' });
  }
}

function statusIntegracao(req, res) {`);
  ac=ac.replace(
    'module.exports = { criarCheckout, statusIntegracao, receberNotificacao };',
    'module.exports = { criarCheckout, criarPix, statusIntegracao, receberNotificacao };'
  );
}
write('src/controllers/asaas.controller.js',ac);

// ---------- Rota do lojista ----------
let ar=read('src/routes/assinaturas.routes.js');
ar=ar.replace(
  "const { criarCheckout, statusIntegracao } = require('../controllers/asaas.controller');",
  "const { criarCheckout, criarPix, statusIntegracao } = require('../controllers/asaas.controller');"
);
if(!ar.includes("router.post('/pix'")) {
  ar=ar.replace("router.post('/checkout', criarCheckout);","router.post('/checkout', criarCheckout);\nrouter.post('/pix', criarPix);");
}
write('src/routes/assinaturas.routes.js',ar);

// ---------- Admin: cria Pix para cliente gerenciado ----------
let c=read('src/controllers/admin.controller.js');
if(!c.includes('async function criarPixClienteGerenciado')) {
  const fn=`
async function criarPixClienteGerenciado(req,res){
  const lojaId=String(req.params.lojaId||'');
  const plano=String(req.body?.plano||'').trim();
  const duracaoMeses=Number(req.body?.duracao_meses);
  if(!ehUuid(lojaId)) return res.status(400).json({erro:'Cliente inválido.'});
  try{
    const {data:loja,error}=await supabase.from('lojas').select('id,dono_id').eq('id',lojaId).maybeSingle();
    if(error||!loja) return res.status(404).json({erro:'Cliente não encontrado.'});
    const {data:usuario}=await supabaseAuth.auth.admin.getUserById(loja.dono_id);
    if(!usuario?.user || usuario.user.app_metadata?.saintsai_managed!==true) return res.status(404).json({erro:'Cliente não encontrado.'});

    const {criarPixPlano}=require('../services/asaas.service');
    const resultado=await criarPixPlano({lojaId,planoCodigo:plano,duracaoMeses});
    return res.status(201).json(resultado);
  }catch(erro){
    if(erro.message==='plano_nao_vendavel') return res.status(400).json({erro:'Este plano não pode ser comprado.'});
    if(erro.message==='preco_nao_configurado') return res.status(503).json({erro:'O preço deste plano ainda não foi configurado.'});
    if(erro.message==='duracao_invalida') return res.status(400).json({erro:'Escolha uma duração válida.'});
    if(erro.message==='pix_chave_ausente') return res.status(503).json({erro:'Sua conta Asaas não possui uma chave Pix ativa.'});
    if(erro.message==='asaas_nao_configurado') return res.status(503).json({erro:'Asaas ainda não está configurado.'});
    console.error('[admin] criar Pix:',erro?.name||'erro');
    return res.status(502).json({erro:'Não foi possível gerar o Pix agora.'});
  }
}
`;
  c=c.replace('\nasync function operacao(req, res) {',fn+'\nasync function operacao(req, res) {');
  c=c.replace(/module\.exports\s*=\s*\{([^}]+)\};/, (m,inner)=>{
    const nomes=inner.split(',').map(x=>x.trim()).filter(Boolean);
    if(!nomes.includes('criarPixClienteGerenciado')) nomes.push('criarPixClienteGerenciado');
    return 'module.exports = { '+nomes.join(', ')+' };';
  });
}
write('src/controllers/admin.controller.js',c);

let rr=read('src/routes/admin.routes.js');
if(!rr.includes("clientes-gerenciados/:lojaId/pix")){
  rr=rr.replace(
    "router.put('/clientes-gerenciados/:lojaId/personalidade', exigirAdmin, controller.atualizarPersonalidadeClienteGerenciado);",
    "router.put('/clientes-gerenciados/:lojaId/personalidade', exigirAdmin, controller.atualizarPersonalidadeClienteGerenciado);\n"+
    "router.post('/clientes-gerenciados/:lojaId/pix', exigirAdmin, controller.criarPixClienteGerenciado);"
  );
}
write('src/routes/admin.routes.js',rr);

// ---------- UI: plano + duração + Pix ----------
let h=read('public/admin-cliente-plano.html');

h=h.replace(
  '<p style="opacity:.75">Escolha o plano do cliente. Você pode gerar um link de pagamento pelo Asaas ou ativar manualmente quando o pagamento já estiver confirmado.</p>',
  '<p style="opacity:.75">Escolha o plano e a duração. O Pix é gerado pelo Asaas e a assinatura é ativada automaticamente quando o webhook confirmar o pagamento.</p>'
);

h=h.replace(
`  <div class="field">
   <label for="validade"><strong>Validade manual (opcional)</strong></label>
   <input id="validade" type="date">
   <small style="opacity:.68">Deixe vazio para uma assinatura sem data manual de expiração.</small>
  </div>

  <div class="secondary-row">
   <button id="gerar-pagamento" type="button" class="btn-secondary">Gerar link de pagamento</button>
   <button id="ativar-manual" type="button" class="btn-secondary">Ativar manualmente</button>
  </div>
  <div id="status" class="status" role="status"></div>`,
`  <div class="field">
   <label for="duracao"><strong>Duração</strong></label>
   <select id="duracao">
    <option value="1">1 mês</option>
    <option value="3">3 meses</option>
    <option value="6">6 meses</option>
    <option value="12">12 meses</option>
   </select>
  </div>

  <button id="gerar-pagamento" type="button" class="btn-primary" style="width:100%;margin-top:14px">Gerar Pix</button>

  <div id="pix-box" class="hidden" style="margin-top:16px;padding:14px;border-radius:16px;background:rgba(127,127,127,.08)">
    <img id="pix-img" alt="QR Code Pix" class="hidden" style="display:block;max-width:240px;width:100%;margin:0 auto 12px;border-radius:12px;background:#fff;padding:8px">
    <strong id="pix-valor"></strong>
    <textarea id="pix-copia" readonly style="width:100%;min-height:100px;margin-top:10px;box-sizing:border-box"></textarea>
    <button id="pix-copiar" type="button" class="btn-secondary" style="width:100%;margin-top:8px">Copiar Pix copia e cola</button>
  </div>

  <div class="secondary-row">
   <button id="ativar-manual" type="button" class="btn-secondary">Ativar manualmente</button>
  </div>
  <div id="status" class="status" role="status"></div>`
);

h=h.replace(
`async function gerarPagamento(){
 const codigo=planoSelecionado(),st=document.getElementById('status');if(!codigo)return st.textContent='Escolha um plano.';
 const b=document.getElementById('gerar-pagamento');b.disabled=true;st.textContent='Gerando link…';
 try{
  const x=await apiFetch('/lojas/'+encodeURIComponent(lojaId)+'/assinatura/checkout',{method:'POST',body:JSON.stringify({plano:codigo})});
  if(!x.checkout_url)throw new Error('Link de pagamento não recebido.');
  const u=new URL(x.checkout_url);if(u.protocol!=='https:'||!(u.hostname==='asaas.com'||u.hostname.endsWith('.asaas.com')))throw new Error('Link de pagamento inválido.');
  try{await navigator.clipboard.writeText(x.checkout_url);st.textContent='Link de pagamento copiado. Envie ao cliente.';}catch(_){st.innerHTML='<a href="'+x.checkout_url+'" target="_blank" rel="noopener">Abrir pagamento</a>';}
 }catch(e){st.textContent=e.message||'Não foi possível gerar o pagamento.';}finally{b.disabled=false;}
}`,
`async function gerarPagamento(){
 const codigo=planoSelecionado(),st=document.getElementById('status');if(!codigo)return st.textContent='Escolha um plano.';
 const duracao=Number(document.getElementById('duracao').value||1);
 const b=document.getElementById('gerar-pagamento');b.disabled=true;st.textContent='Gerando Pix…';
 try{
  const x=await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId)+'/pix',{method:'POST',body:JSON.stringify({plano:codigo,duracao_meses:duracao})});
  if(!x.pix_copia_cola)throw new Error('Código Pix não recebido.');
  document.getElementById('pix-box').classList.remove('hidden');
  document.getElementById('pix-copia').value=x.pix_copia_cola;
  document.getElementById('pix-valor').textContent='Valor: '+((Number(x.valor_centavos||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}))+' · '+duracao+' mês(es)';
  const img=document.getElementById('pix-img');
  if(x.qr_code_base64){img.src=x.qr_code_base64.startsWith('data:')?x.qr_code_base64:'data:image/png;base64,'+x.qr_code_base64;img.classList.remove('hidden');}
  else{img.classList.add('hidden');}
  st.textContent='Pix gerado. Aguardando confirmação do pagamento…';
 }catch(e){st.textContent=e.message||'Não foi possível gerar o Pix.';}finally{b.disabled=false;}
}`
);

h=h.replace(
  "const validade=document.getElementById('validade').value||null;",
  "const meses=Number(document.getElementById('duracao').value||1);const validade=new Date();validade.setMonth(validade.getMonth()+meses);"
);
h=h.replace(
  "body:JSON.stringify({plano:codigo,status:'ativo',valido_ate:validade})",
  "body:JSON.stringify({plano:codigo,status:'ativo',valido_ate:validade.toISOString()})"
);

h=h.replace(
  "document.getElementById('gerar-pagamento').addEventListener('click',gerarPagamento);",
  "document.getElementById('gerar-pagamento').addEventListener('click',gerarPagamento);\n"+
  "document.getElementById('pix-copiar').addEventListener('click',async()=>{const v=document.getElementById('pix-copia').value;try{await navigator.clipboard.writeText(v);document.getElementById('status').textContent='Pix copia e cola copiado.';}catch(_){document.getElementById('pix-copia').select();}});"
);

h=h.replace(
  "document.getElementById('continuar').addEventListener('click',()=>{window.location.href='admin-cliente-whatsapp.html?loja='+encodeURIComponent(lojaId);});\ncarregar();",
  "document.getElementById('continuar').disabled=true;\n"+
  "document.getElementById('continuar').addEventListener('click',()=>{window.location.href='admin-cliente-whatsapp.html?loja='+encodeURIComponent(lojaId);});\n"+
  "async function conferirPagamento(){try{const x=await apiFetch('/admin/lojas/'+encodeURIComponent(lojaId)+'/assinatura');const ativo=Boolean(x?.situacao?.ativo);document.getElementById('continuar').disabled=!ativo;if(ativo&&document.getElementById('status').textContent.includes('Aguardando'))document.getElementById('status').textContent='Pagamento confirmado. Plano ativado automaticamente.';}catch(_){}}\n"+
  "carregar().then(conferirPagamento);setInterval(conferirPagamento,5000);"
);
write('public/admin-cliente-plano.html',h);

// ---------- WhatsApp só libera após plano ativo ----------
let w=read('public/admin-cliente-whatsapp.html');
if(!w.includes('async function validarPlanoAntesWhatsapp')){
  w=w.replace(
    "async function carregar(){",
    "async function validarPlanoAntesWhatsapp(){try{const x=await apiFetch('/admin/lojas/'+encodeURIComponent(lojaId)+'/assinatura');const ativo=Boolean(x?.situacao?.ativo);$('gerar').disabled=!ativo;if(!ativo){$('status').textContent='O WhatsApp será liberado após a confirmação do pagamento do plano.';}return ativo;}catch(_){$('gerar').disabled=true;return false;}}\nasync function carregar(){"
  );
  w=w.replace(
    "await statusWa();timer=setInterval(statusWa,5000);",
    "await validarPlanoAntesWhatsapp();await statusWa();timer=setInterval(()=>{validarPlanoAntesWhatsapp();statusWa();},5000);"
  );
  w=w.replace(
    "$('gerar').onclick=async()=>{",
    "$('gerar').onclick=async()=>{if(!(await validarPlanoAntesWhatsapp()))return;"
  );
}
write('public/admin-cliente-whatsapp.html',w);

console.log('Pix por plano/duração e ativação automática por webhook aplicados.');
