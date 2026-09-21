const fs = require('node:fs');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, v) { fs.writeFileSync(p, v); }

// API protegida para configurações simples do agente do próprio lojista.
write('src/controllers/clienteAgente.controller.js', `
const supabase = require('../config/supabase');

const PERSONALIDADES = Object.freeze({
  amigavel: 'Seja amigável, acolhedor e claro, sem exagerar na informalidade.',
  profissional: 'Seja profissional, educado, objetivo e organizado.',
  direto: 'Seja direto e breve, priorizando respostas curtas e úteis.',
  casual: 'Seja casual e natural, com linguagem simples de conversa.',
  entusiasmado: 'Seja positivo e entusiasmado, sem pressionar o cliente.'
});

function limparBlocoGerenciado(prompt) {
  return String(prompt || '')
    .replace(/\\n*\\[SAINTSAI_CONFIG_CLIENTE\\][\\s\\S]*?\\[\\/SAINTSAI_CONFIG_CLIENTE\\]\\n*/g, '\\n')
    .trim();
}

function blocoGerenciado(personalidade, aviso, avisoAtivo) {
  const linhas = [
    '[SAINTSAI_CONFIG_CLIENTE]',
    'PERSONALIDADE DO ATENDENTE: ' + PERSONALIDADES[personalidade]
  ];
  if (avisoAtivo && aviso) {
    linhas.push('AVISO TEMPORÁRIO DA LOJA: ' + aviso);
    linhas.push('REGRA DO AVISO: use esse aviso somente quando ele for realmente relevante à intenção, data, horário ou ação que o cliente está discutindo. Exemplo: se o aviso é que hoje a loja fecha uma hora mais cedo, mencione isso quando o cliente pretende retirar/visitar hoje. Se a conversa indica retirada em outro dia ou o aviso não muda a decisão do cliente, não mencione. Não repita o aviso sem necessidade.');
  }
  linhas.push('[/SAINTSAI_CONFIG_CLIENTE]');
  return linhas.join('\\n');
}

async function lojaDoUsuario(lojaId, usuarioId) {
  const { data, error } = await supabase
    .from('lojas')
    .select('id, dono_id, agente_personalidade, agente_aviso, agente_aviso_ativo, prompt_mestre')
    .eq('id', lojaId)
    .eq('dono_id', usuarioId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function obter(req, res) {
  try {
    const loja = await lojaDoUsuario(req.params.lojaId, req.usuario.id);
    if (!loja) return res.status(404).json({ erro: 'Loja não encontrada.' });
    return res.json({
      personalidade: loja.agente_personalidade || 'amigavel',
      aviso: loja.agente_aviso || '',
      aviso_ativo: Boolean(loja.agente_aviso_ativo)
    });
  } catch (_) {
    return res.status(500).json({ erro: 'Não foi possível carregar as configurações do agente.' });
  }
}

async function salvar(req, res) {
  const lojaId = String(req.params.lojaId || '');
  const personalidade = String(req.body?.personalidade || '');
  const aviso = String(req.body?.aviso || '').trim();
  const avisoAtivo = Boolean(req.body?.aviso_ativo);

  if (!Object.prototype.hasOwnProperty.call(PERSONALIDADES, personalidade)) {
    return res.status(400).json({ erro: 'Personalidade inválida.' });
  }
  if (aviso.length > 1000) {
    return res.status(400).json({ erro: 'O aviso pode ter no máximo 1000 caracteres.' });
  }
  if (avisoAtivo && !aviso) {
    return res.status(400).json({ erro: 'Escreva um aviso antes de ativá-lo.' });
  }

  try {
    const loja = await lojaDoUsuario(lojaId, req.usuario.id);
    if (!loja) return res.status(404).json({ erro: 'Loja não encontrada.' });

    const base = limparBlocoGerenciado(loja.prompt_mestre);
    const bloco = blocoGerenciado(personalidade, aviso, avisoAtivo);
    const promptMestre = [base, bloco].filter(Boolean).join('\\n\\n');

    const { error } = await supabase
      .from('lojas')
      .update({
        agente_personalidade: personalidade,
        agente_aviso: aviso || null,
        agente_aviso_ativo: avisoAtivo,
        prompt_mestre: promptMestre
      })
      .eq('id', lojaId)
      .eq('dono_id', req.usuario.id);

    if (error) throw error;

    return res.json({
      personalidade,
      aviso,
      aviso_ativo: avisoAtivo
    });
  } catch (_) {
    return res.status(500).json({ erro: 'Não foi possível salvar as configurações do agente.' });
  }
}

module.exports = { obter, salvar };
`);

write('src/routes/clienteAgente.routes.js', `
const express = require('express');
const { exigirLogin } = require('../middleware/auth');
const controller = require('../controllers/clienteAgente.controller');

const router = express.Router({ mergeParams: true });
router.use(exigirLogin);
router.get('/', controller.obter);
router.put('/', controller.salvar);
module.exports = router;
`);

let app = read('src/app.js');
if (!app.includes("clienteAgenteRoutes")) {
  app = app.replace(
    "const adminRoutes = require('./routes/admin.routes');",
    "const adminRoutes = require('./routes/admin.routes');\nconst clienteAgenteRoutes = require('./routes/clienteAgente.routes');"
  );
  app = app.replace(
    "app.use('/api/lojas/:lojaId/assinatura', assinaturasRoutes);",
    "app.use('/api/lojas/:lojaId/assinatura', assinaturasRoutes);\napp.use('/api/lojas/:lojaId/cliente-agente', clienteAgenteRoutes);"
  );
}
write('src/app.js', app);

// Permite o APK do cliente usar o login existente e cair no shell restrito.
let login = read('public/login.html');
login = login.replace(
  "const destinoPermitido = ['dashboard.html', 'whatsapp.html'];",
  "const destinoPermitido = ['dashboard.html', 'whatsapp.html', 'cliente-estoque.html'];"
);
write('public/login.html', login);

write('public/cliente-estoque.html', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#08070d">
<title>SaintsAI Estoque</title>
<link rel="stylesheet" href="css/styles.css">
<script src="js/theme.js"></script>
<script src="js/guard.js"></script>
<style>
html,body{margin:0;min-height:100%;background:#08070d;color:#fff;font-family:Manrope,system-ui,sans-serif}
.cliente-shell{min-height:100vh;display:flex;flex-direction:column}
.cliente-top{position:sticky;top:0;z-index:20;background:rgba(8,7,13,.96);backdrop-filter:blur(14px);border-bottom:1px solid rgba(160,95,255,.25);padding:14px 16px 12px}
.cliente-brand{font-weight:800;font-size:18px;margin-bottom:12px}
.cliente-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cliente-tab{border:1px solid rgba(170,110,255,.25);background:#111018;color:#c8c3d0;border-radius:14px;padding:11px 10px;font-weight:700}
.cliente-tab.ativo{background:linear-gradient(135deg,#7d35ff,#b05cff);color:#fff;border-color:transparent}
.cliente-conteudo{flex:1;min-height:0}
#estoque-frame{width:100%;height:calc(100vh - 102px);border:0;background:#08070d}
#painel-agente{padding:20px 16px 40px;max-width:720px;margin:0 auto}
.agent-card{background:#111018;border:1px solid rgba(170,110,255,.25);border-radius:22px;padding:18px}
.agent-card h1{margin:0 0 8px;font-size:24px}
.agent-card p{color:#aaa4b5;line-height:1.5}
.agent-field{display:flex;flex-direction:column;gap:8px;margin-top:18px}
.agent-field label{font-weight:700}
.agent-field select,.agent-field textarea{width:100%;box-sizing:border-box;background:#09080f;color:#fff;border:1px solid #332944;border-radius:14px;padding:13px;font:inherit}
.agent-field textarea{min-height:130px;resize:vertical}
.agent-switch{display:flex;align-items:center;gap:10px;margin-top:16px}
.agent-actions{display:flex;gap:10px;margin-top:18px}
.agent-save{flex:1;border:0;border-radius:14px;padding:13px 16px;background:linear-gradient(135deg,#7d35ff,#b05cff);color:#fff;font-weight:800}
.agent-status{margin-top:12px;min-height:22px;color:#bda7e8}
.hidden{display:none!important}
</style>
</head>
<body>
<div class="cliente-shell">
  <header class="cliente-top">
    <div class="cliente-brand">SaintsAI Estoque</div>
    <div class="cliente-tabs">
      <button id="tab-estoque" class="cliente-tab ativo" type="button">Estoque</button>
      <button id="tab-agente" class="cliente-tab" type="button">Gerenciar agente</button>
    </div>
  </header>

  <main class="cliente-conteudo">
    <iframe id="estoque-frame" src="estoque.html" title="Estoque"></iframe>

    <section id="painel-agente" class="hidden">
      <div class="agent-card">
        <h1>Gerenciar agente</h1>
        <p>Escolha somente a personalidade do atendente e, quando precisar, deixe um aviso temporário para a IA considerar durante as conversas.</p>

        <div class="agent-field">
          <label for="personalidade">Personalidade</label>
          <select id="personalidade">
            <option value="amigavel">Amigável</option>
            <option value="profissional">Profissional</option>
            <option value="direto">Direto</option>
            <option value="casual">Casual</option>
            <option value="entusiasmado">Entusiasmado</option>
          </select>
        </div>

        <div class="agent-field">
          <label for="aviso">Aviso da loja</label>
          <textarea id="aviso" maxlength="1000" placeholder="Ex.: Hoje vamos fechar uma hora mais cedo."></textarea>
        </div>

        <label class="agent-switch">
          <input id="aviso-ativo" type="checkbox">
          <span>Usar este aviso nas conversas quando for relevante</span>
        </label>

        <p>A IA não deve repetir o aviso para todo mundo. Ela só usa quando o contexto indicar que isso muda algo para o cliente, como uma retirada ou visita no período afetado.</p>

        <div class="agent-actions">
          <button id="salvar-agente" class="agent-save" type="button">Salvar alterações</button>
        </div>
        <div id="agent-status" class="agent-status" role="status"></div>
      </div>
    </section>
  </main>
</div>

<script src="js/config.js"></script>
<script src="js/auth.js"></script>
<script src="js/api.js"></script>
<script src="js/loja.js"></script>
<script>
const frame = document.getElementById('estoque-frame');
const painel = document.getElementById('painel-agente');
const tabEstoque = document.getElementById('tab-estoque');
const tabAgente = document.getElementById('tab-agente');
let lojaAtual = null;

function mostrar(secao) {
  const estoque = secao === 'estoque';
  frame.classList.toggle('hidden', !estoque);
  painel.classList.toggle('hidden', estoque);
  tabEstoque.classList.toggle('ativo', estoque);
  tabAgente.classList.toggle('ativo', !estoque);
}

function restringirFrame() {
  try {
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) return;
    if (!win.location.pathname.endsWith('/painel/estoque.html')) {
      win.location.replace('estoque.html');
      return;
    }
    const style = doc.createElement('style');
    style.textContent = '#sidebar-container,#topbar-container,#tabbar-container{display:none!important}.app-shell{display:block!important}.main-col{display:block!important}.page{padding:16px!important;padding-bottom:40px!important}';
    doc.head.appendChild(style);
    const vazioLink = doc.querySelector('#estado-vazio a[href="produtos.html"]');
    if (vazioLink) vazioLink.style.display = 'none';
  } catch (_) {}
}
frame.addEventListener('load', restringirFrame);

async function carregarAgente() {
  const status = document.getElementById('agent-status');
  status.textContent = 'Carregando…';
  try {
    lojaAtual = await obterLojaAtual();
    if (!lojaAtual) throw new Error('Nenhuma loja encontrada.');
    const cfg = await apiFetch('/lojas/' + lojaAtual.id + '/cliente-agente');
    document.getElementById('personalidade').value = cfg.personalidade || 'amigavel';
    document.getElementById('aviso').value = cfg.aviso || '';
    document.getElementById('aviso-ativo').checked = Boolean(cfg.aviso_ativo);
    status.textContent = '';
  } catch (e) {
    if (e instanceof SessaoExpiradaError) return fazerLogout();
    status.textContent = e.message || 'Não foi possível carregar.';
  }
}

tabEstoque.addEventListener('click', () => mostrar('estoque'));
tabAgente.addEventListener('click', async () => {
  mostrar('agente');
  if (!lojaAtual) await carregarAgente();
});

document.getElementById('salvar-agente').addEventListener('click', async () => {
  const botao = document.getElementById('salvar-agente');
  const status = document.getElementById('agent-status');
  if (!lojaAtual) await carregarAgente();
  if (!lojaAtual) return;
  botao.disabled = true;
  status.textContent = 'Salvando…';
  try {
    await apiFetch('/lojas/' + lojaAtual.id + '/cliente-agente', {
      method: 'PUT',
      body: JSON.stringify({
        personalidade: document.getElementById('personalidade').value,
        aviso: document.getElementById('aviso').value.trim(),
        aviso_ativo: document.getElementById('aviso-ativo').checked
      })
    });
    status.textContent = 'Configuração salva.';
  } catch (e) {
    if (e instanceof SessaoExpiradaError) return fazerLogout();
    status.textContent = e.message || 'Não foi possível salvar.';
  } finally {
    botao.disabled = false;
  }
});
</script>
</body>
</html>`);

console.log('Patch do app cliente Estoque + Gerenciar agente aplicado.');
