const fs = require('node:fs');

function replaceOnce(path, from, to) {
  let src = fs.readFileSync(path, 'utf8');
  if (!src.includes(from)) throw new Error('Trecho esperado não encontrado em ' + path);
  src = src.replace(from, to);
  fs.writeFileSync(path, src);
}

const servicePath = 'src/services/metaEmbeddedSignup.service.js';
fs.writeFileSync(servicePath, `const configuracoes = require('./whatsappConfiguracao.service');
const credenciais = require('./whatsappCredencial.service');

const META_APP_ID = process.env.META_APP_ID || '';
const META_APP_SECRET = process.env.META_APP_SECRET || '';
const META_CONFIG_ID = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '';
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0';
const META_HOSTED_ES_URL = process.env.META_HOSTED_ES_URL || ''; // legado; não usado no fluxo atual

class ErroEmbeddedSignup extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem || 'Não foi possível concluir a conexão com a Meta.');
    this.name = 'ErroEmbeddedSignup';
    this.status = status;
  }
}

function textoId(valor, nome) {
  if (typeof valor !== 'string' || !/^[0-9]{5,40}$/.test(valor.trim())) {
    throw new ErroEmbeddedSignup(nome + ' inválido.');
  }
  return valor.trim();
}

function configurado() {
  return Boolean(META_APP_ID && META_APP_SECRET && META_CONFIG_ID);
}

function obterConfiguracaoPublica() {
  return {
    disponivel: configurado(),
    app_id: META_APP_ID || null,
    config_id: META_CONFIG_ID || null,
    graph_version: META_GRAPH_VERSION,
    hosted_url: null,
  };
}

async function metaFetch(path, { method = 'GET', token, body } = {}) {
  const url = 'https://graph.facebook.com/' + META_GRAPH_VERSION + path;
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  let payload;
  if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let resposta;
  try {
    resposta = await fetch(url, {
      method,
      headers,
      body: payload,
      signal: AbortSignal.timeout(15000),
    });
  } catch (_) {
    throw new ErroEmbeddedSignup('A Meta não respondeu a tempo. Tente novamente.', 502);
  }
  const data = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const codigo = data && data.error && data.error.code;
    console.warn('[meta embedded signup] falha_graph', { status: resposta.status, codigo: codigo || null });
    throw new ErroEmbeddedSignup('A Meta recusou a conclusão da conexão. Refaça a autorização.', 502);
  }
  return data;
}

async function trocarCodePorToken(code) {
  if (typeof code !== 'string' || code.length < 8 || code.length > 4096) {
    throw new ErroEmbeddedSignup('Código temporário da Meta inválido.');
  }
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    code,
  });
  let resposta;
  try {
    resposta = await fetch('https://graph.facebook.com/' + META_GRAPH_VERSION + '/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    });
  } catch (_) {
    throw new ErroEmbeddedSignup('A Meta não respondeu ao autorizar a conta. Tente novamente.', 502);
  }
  const data = await resposta.json().catch(() => ({}));
  if (!resposta.ok || !data.access_token) {
    console.warn('[meta embedded signup] troca_code_falhou', {
      status: resposta.status,
      codigo: data && data.error && data.error.code ? data.error.code : null,
    });
    throw new ErroEmbeddedSignup('A autorização da Meta expirou ou não pôde ser validada. Refaça a conexão.', 502);
  }
  return data.access_token;
}

async function concluir({ lojaId, code, wabaId, phoneNumberId }) {
  if (!configurado()) {
    throw new ErroEmbeddedSignup('Embedded Signup ainda não foi ativado pelo administrador do SaintsAI.', 503);
  }
  const waba_id = textoId(wabaId, 'WABA ID');
  const accessToken = await trocarCodePorToken(code);

  let phone_number_id = null;
  if (typeof phoneNumberId === 'string' && /^[0-9]{5,40}$/.test(phoneNumberId.trim())) {
    phone_number_id = phoneNumberId.trim();
  }

  // Em versões recentes/coexistência do Embedded Signup, a Meta pode concluir
  // o onboarding retornando apenas o WABA ID. Nesse caso descobrimos o número
  // automaticamente pelo Graph API, sem pedir IDs ao cliente.
  if (!phone_number_id) {
    const numeros = await metaFetch('/' + waba_id + '/phone_numbers?fields=id,display_phone_number,verified_name', {
      token: accessToken,
    });
    const lista = Array.isArray(numeros && numeros.data) ? numeros.data : [];
    if (!lista.length) {
      throw new ErroEmbeddedSignup('A Meta autorizou a conta, mas ainda não disponibilizou o número do WhatsApp. Conclua a seleção/verificação do número e tente novamente.', 502);
    }
    // O Embedded Signup normalmente disponibiliza o número recém-onboarded.
    // Se houver vários, prioriza o primeiro retornado pela própria Meta.
    phone_number_id = textoId(String(lista[0].id || ''), 'Phone Number ID');
  }

  const infoNumero = await metaFetch('/' + phone_number_id + '?fields=display_phone_number,verified_name', {
    token: accessToken,
  });
  const numero = typeof infoNumero.display_phone_number === 'string'
    ? infoNumero.display_phone_number.trim()
    : '';
  if (!numero) {
    throw new ErroEmbeddedSignup('A Meta conectou a conta, mas não retornou o número selecionado.', 502);
  }

  await metaFetch('/' + waba_id + '/subscribed_apps', {
    method: 'POST',
    token: accessToken,
    body: {},
  });

  const existentes = await configuracoes.listarConfiguracoesWhatsapp(lojaId);
  let config = Array.isArray(existentes)
    ? (existentes.find((c) => c.provedor === 'meta' && c.ativo) || existentes.find((c) => c.provedor === 'meta'))
    : null;

  const dados = {
    provedor: 'meta',
    numero_whatsapp: numero,
    identificador_externo: phone_number_id,
    ativo: true,
  };

  if (config) {
    config = await configuracoes.atualizarConfiguracaoWhatsapp(config.id, lojaId, dados);
  } else {
    config = await configuracoes.criarConfiguracaoWhatsapp(dados, lojaId);
  }

  await credenciais.salvarCredencialMeta(config.id, lojaId, accessToken);

  return {
    conectado: true,
    configuracao: config,
    waba_id,
    phone_number_id,
    numero_whatsapp: numero,
    verified_name: infoNumero.verified_name || null,
  };
}

module.exports = {
  ErroEmbeddedSignup,
  obterConfiguracaoPublica,
  concluir,
};
`);


// Garante que o retorno OAuth usado no mobile seja servido antes do fallback 404.
replaceOnce(
  'src/app.js',
  "app.use('/api/auth', authRoutes);",
  "app.use(require('express').static(require('node:path').join(process.cwd(), 'public')));\napp.get('/whatsapp.html', (req, res) => res.sendFile(require('node:path').join(process.cwd(), 'public', 'whatsapp.html')));\n\napp.use('/api/auth', authRoutes);"
);

replaceOnce(
  'src/controllers/whatsappConfiguracao.controller.js',
  "const credenciais = require('../services/whatsappCredencial.service');",
  "const credenciais = require('../services/whatsappCredencial.service');\nconst embeddedSignup = require('../services/metaEmbeddedSignup.service');"
);

replaceOnce(
  'src/controllers/whatsappConfiguracao.controller.js',
  "  if (erro instanceof credenciais.ErroChaveCredenciaisAusente) return res.status(503).json({ erro: 'Armazenamento seguro de credenciais indisponível.' });",
  "  if (erro instanceof credenciais.ErroChaveCredenciaisAusente) return res.status(503).json({ erro: 'Armazenamento seguro de credenciais indisponível.' });\n  if (erro instanceof embeddedSignup.ErroEmbeddedSignup) return res.status(erro.status || 400).json({ erro: erro.message });"
);

replaceOnce(
  'src/controllers/whatsappConfiguracao.controller.js',
  "module.exports = { criar, listar, buscar, atualizar, desativar, salvarCredencial, estadoCredencial, removerCredencial };",
  `async function configuracaoEmbeddedSignup(req, res) {
  return res.json(embeddedSignup.obterConfiguracaoPublica());
}

async function eventoEmbeddedSignup(req, res) {
  const corpo = req.body || {};
  console.info('[meta embedded signup] evento_cliente', {
    loja_id: req.params.lojaId,
    etapa: typeof corpo.etapa === 'string' ? corpo.etapa.slice(0, 80) : null,
    evento: typeof corpo.evento === 'string' ? corpo.evento.slice(0, 80) : null,
    tem_waba: Boolean(corpo.tem_waba),
    tem_phone: Boolean(corpo.tem_phone),
    tem_code: Boolean(corpo.tem_code),
  });
  return res.json({ ok: true });
}

async function concluirEmbeddedSignup(req, res) {
  try {
    const resultado = await embeddedSignup.concluir({
      lojaId: req.params.lojaId,
      code: req.body && req.body.code,
      wabaId: req.body && req.body.waba_id,
      phoneNumberId: req.body && req.body.phone_number_id,
    });
    return res.json(resultado);
  } catch (erro) {
    return responderErro(res, erro);
  }
}

module.exports = {
  criar, listar, buscar, atualizar, desativar, salvarCredencial,
  estadoCredencial, removerCredencial, configuracaoEmbeddedSignup, eventoEmbeddedSignup, concluirEmbeddedSignup
};`
);

replaceOnce(
  'src/routes/whatsappConfiguracao.routes.js',
  "router.get('/historico/conversas', historicoController.listarConversas);",
  "router.get('/embedded-signup/config', controller.configuracaoEmbeddedSignup);\nrouter.post('/embedded-signup/event', controller.eventoEmbeddedSignup);
router.post('/embedded-signup/complete', controller.concluirEmbeddedSignup);\n\nrouter.get('/historico/conversas', historicoController.listarConversas);"
);

replaceOnce(
  'public/whatsapp.html',
  `      <section class="wa-grid" aria-label="Configuração do WhatsApp">`,
  `      <section class="wa-card" aria-label="Conexão automática com a Meta" id="wa-embedded-card">
        <div class="wa-card-head">
          <div>
            <span class="eyebrow">Recomendado</span>
            <h2>Conectar WhatsApp automaticamente</h2>
            <p>O cliente entra na Meta, escolhe a empresa e confirma o número. O SaintsAI configura o Phone Number ID e a credencial sem precisar copiar token.</p>
          </div>
          <span id="wa-embedded-status" class="badge badge-inativo">Verificando…</span>
        </div>
        <div class="wa-actions">
          <button id="wa-conectar-meta" type="button" class="btn-primary">Conectar com Meta</button>
        </div>
        <div class="field-help" id="wa-embedded-ajuda">A autorização abre em uma janela oficial da Meta.</div>
      </section>

      <details class="wa-card" style="margin-top:16px">
        <summary style="cursor:pointer;font-weight:700">Configuração manual avançada</summary>
        <p class="field-help" style="margin-top:10px">Use esta opção apenas se o Embedded Signup estiver indisponível.</p>
      </details>

      <section class="wa-grid" aria-label="Configuração do WhatsApp">`
);

replaceOnce(
  'public/whatsapp.html',
  '<script src="js/config.js"></script>',
  '<div id="fb-root"></div>\n<script async defer crossorigin="anonymous" src="https://connect.facebook.net/pt_BR/sdk.js"></script>\n<script src="js/config.js"></script>'
);

let js = fs.readFileSync('public/js/whatsapp.js', 'utf8');
js += `

// ---------- Embedded Signup Meta ----------
(function waProcessarRetornoOAuthMeta() {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'SAINTSAI_META_OAUTH_CODE', code }, window.location.origin);
      setTimeout(() => window.close(), 250);
      return;
    }
    sessionStorage.setItem('saintsai_meta_oauth_code', code);
    history.replaceState({}, document.title, window.location.pathname);
  } catch (_) {}
})();

let waEmbeddedCfg = null;
let waEmbeddedCode = null;
let waEmbeddedSession = null;
let waEmbeddedEnviando = false;

function waMetaOrigemValida(origin) {
  try {
    const host = new URL(origin).hostname;
    return host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.com' || host.endsWith('.fb.com');
  } catch (_) { return false; }
}

function waRegistrarEventoMeta(etapa, dados = {}) {
  try {
    if (!waLojaId) return;
    fetch('/api/lojas/' + waLojaId + '/whatsapp/embedded-signup/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('lojaia_token') ? { Authorization: 'Bearer ' + localStorage.getItem('lojaia_token') } : {})
      },
      body: JSON.stringify({
        etapa,
        evento: dados.evento || null,
        tem_waba: Boolean(dados.tem_waba),
        tem_phone: Boolean(dados.tem_phone),
        tem_code: Boolean(dados.tem_code),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch (_) {}
}

function waEmbeddedEstado(texto, ok) {
  const badge = document.getElementById('wa-embedded-status');
  if (!badge) return;
  badge.textContent = texto;
  badge.classList.toggle('badge-ativo', Boolean(ok));
  badge.classList.toggle('badge-inativo', !ok);
}

async function waTentarConcluirEmbedded() {
  if (waEmbeddedEnviando || !waEmbeddedCode || !waEmbeddedSession || !waEmbeddedSession.waba_id || !waLojaId) return;
  waEmbeddedEnviando = true;
  const botao = document.getElementById('wa-conectar-meta');
  if (botao) { botao.disabled = true; botao.textContent = 'Concluindo conexão…'; }
  try {
    const resultado = await apiFetch('/lojas/' + waLojaId + '/whatsapp/embedded-signup/complete', {
      method: 'POST',
      body: JSON.stringify({
        code: waEmbeddedCode,
        waba_id: waEmbeddedSession.waba_id,
        phone_number_id: waEmbeddedSession.phone_number_id,
      }),
    });
    waEmbeddedCode = null;
    waEmbeddedSession = null;
    waEmbeddedEstado('Conectado', true);
    await waCarregarConfiguracao();
    mostrarToast('WhatsApp conectado automaticamente com a Meta.', 'sucesso');
    const ajuda = document.getElementById('wa-embedded-ajuda');
    if (ajuda && resultado && resultado.numero_whatsapp) {
      ajuda.textContent = 'Número conectado: ' + resultado.numero_whatsapp;
    }
  } catch (erro) {
    if (erro instanceof SessaoExpiradaError) return fazerLogout();
    waErro(erro.message || 'Não foi possível concluir a conexão automática.');
    waEmbeddedEstado('Falha ao conectar', false);
  } finally {
    waEmbeddedEnviando = false;
    if (botao) { botao.disabled = false; botao.textContent = 'Conectar com Meta'; }
  }
}

window.addEventListener('message', (event) => {
  if (!waMetaOrigemValida(event.origin)) return;
  let data = event.data;
  try { if (typeof data === 'string') data = JSON.parse(data); } catch (_) { return; }
  if (!data || data.type !== 'WA_EMBEDDED_SIGNUP') return;
  waRegistrarEventoMeta('mensagem_meta', {
    evento: data.event,
    tem_waba: Boolean(data.data && data.data.waba_id),
    tem_phone: Boolean(data.data && data.data.phone_number_id),
    tem_code: Boolean(waEmbeddedCode),
  });
  if (data.event === 'FINISH' || data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
    if (data.data && data.data.waba_id) {
      waEmbeddedSession = {
        waba_id: String(data.data.waba_id),
        phone_number_id: data.data.phone_number_id ? String(data.data.phone_number_id) : null,
      };
      waEmbeddedEstado(
        data.data.phone_number_id ? 'Concluindo conexão…' : 'WhatsApp autorizado — identificando número…',
        false
      );
      waTentarConcluirEmbedded();
    }
  } else if (data.event === 'CANCEL') {
    waEmbeddedEstado('Cancelado', false);
  } else if (data.event === 'ERROR') {
    waEmbeddedEstado('Erro na Meta', false);
  }
});

window.fbAsyncInit = function () {
  if (!waEmbeddedCfg || !waEmbeddedCfg.disponivel) return;
  FB.init({
    appId: waEmbeddedCfg.app_id,
    cookie: true,
    xfbml: false,
    version: waEmbeddedCfg.graph_version || 'v25.0',
  });
  waEmbeddedEstado('Pronto para conectar', true);
};

async function waPrepararEmbeddedSignup() {
  const botao = document.getElementById('wa-conectar-meta');
  if (!botao) return;
  try {
    if (!waLojaId) {
      const loja = await obterLojaAtual();
      if (loja) waLojaId = loja.id;
    }
    waEmbeddedCfg = await apiFetch('/lojas/' + waLojaId + '/whatsapp/embedded-signup/config');
    if (!waEmbeddedCfg || !waEmbeddedCfg.disponivel) {
      botao.disabled = true;
      waEmbeddedEstado('Aguardando ativação', false);
      document.getElementById('wa-embedded-ajuda').textContent =
        'O administrador precisa informar o App ID e o Configuration ID da Meta uma única vez.';
      return;
    }
    if (window.FB && typeof window.FB.init === 'function') {
      window.fbAsyncInit();
    }
  } catch (erro) {
    if (erro instanceof SessaoExpiradaError) return fazerLogout();
    botao.disabled = true;
    waEmbeddedEstado('Indisponível', false);
  }
}

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data || data.type !== 'SAINTSAI_META_OAUTH_CODE' || !data.code) return;
  waEmbeddedCode = String(data.code);
  waTentarConcluirEmbedded();
});

document.getElementById('wa-conectar-meta').addEventListener('click', () => {
  waLimparErro();
  if (!waEmbeddedCfg || !waEmbeddedCfg.disponivel) {
    return waErro('A conexão automática com a Meta ainda não está disponível.');
  }

  if (!window.FB) {
    return waErro('A Meta ainda não carregou. Aguarde alguns segundos e tente novamente.');
  }

  waEmbeddedCode = null;
  waEmbeddedSession = null;
  waEmbeddedEstado('Abrindo cadastro do WhatsApp…', false);

  FB.login((response) => {
    if (response && response.authResponse && response.authResponse.code) {
      waEmbeddedCode = String(response.authResponse.code);
      waRegistrarEventoMeta('facebook_login_callback', { tem_code: true, tem_waba: Boolean(waEmbeddedSession && waEmbeddedSession.waba_id), tem_phone: Boolean(waEmbeddedSession && waEmbeddedSession.phone_number_id) });
      waEmbeddedEstado(
        waEmbeddedSession ? 'Concluindo conexão…' : 'Autorizado — aguardando WhatsApp…',
        false
      );
      waTentarConcluirEmbedded();
    } else {
      waEmbeddedEstado('Cadastro não concluído', false);
    }
  }, {
    config_id: waEmbeddedCfg.config_id,
    response_type: 'code',
    override_default_response_type: true,
    extras: {
      setup: {},
      featureType: '',
      sessionInfoVersion: '3'
    }
  });
});

waPrepararEmbeddedSignup();
`;
fs.writeFileSync('public/js/whatsapp.js', js);

if (fs.existsSync('.env.example')) {
  let env = fs.readFileSync('.env.example', 'utf8');
  if (!env.includes('META_APP_ID=')) env += '\n# Meta Embedded Signup\nMETA_APP_ID=\nMETA_EMBEDDED_SIGNUP_CONFIG_ID=\nMETA_GRAPH_VERSION=v25.0\nMETA_HOSTED_ES_URL=\n';
  fs.writeFileSync('.env.example', env);
}


console.log('Patch do Meta Embedded Signup aplicado.');
