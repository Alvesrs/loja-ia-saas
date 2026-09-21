const fs = require('node:fs');

const estoqueHtml = fs.readFileSync('public/estoque.html', 'utf8');
let estoqueJs = fs.readFileSync('public/js/estoque.js', 'utf8');

const inicioMain = estoqueHtml.indexOf('<main class="page">');
const fimMain = estoqueHtml.indexOf('</main>', inicioMain);
if (inicioMain < 0 || fimMain < 0) throw new Error('Conteúdo principal do estoque não encontrado.');

let estoqueMain = estoqueHtml.slice(inicioMain, fimMain + '</main>'.length);
estoqueMain = estoqueMain.replace(
  /<a href="produtos\.html"[\s\S]*?<\/a>/,
  '<p class="page-sub" style="margin-top:16px">Peça ao administrador para cadastrar o primeiro produto.</p>'
);

estoqueJs = estoqueJs.replace(/\nmontarLayout\('estoque'\);\s*\ncarregarEstoque\(\);\s*$/m, '\ncarregarEstoque();\n');
fs.writeFileSync('public/js/cliente-estoque.js', estoqueJs);

const pagina = `<!DOCTYPE html>
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
html,body{margin:0;min-height:100%;background:#08070d;color:#fff}
.cliente-shell{min-height:100vh}
.cliente-top{position:sticky;top:0;z-index:30;background:rgba(8,7,13,.97);backdrop-filter:blur(14px);border-bottom:1px solid rgba(160,95,255,.25);padding:14px 16px 12px}
.cliente-brand{font-weight:800;font-size:18px;margin-bottom:12px}
.cliente-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cliente-tab{border:1px solid rgba(170,110,255,.25);background:#111018;color:#c8c3d0;border-radius:14px;padding:11px 10px;font-weight:700}
.cliente-tab.ativo{background:linear-gradient(135deg,#7d35ff,#b05cff);color:#fff;border-color:transparent}
#cliente-estoque-view .page{padding:18px 16px 40px;max-width:900px;margin:0 auto}
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

  <section id="cliente-estoque-view">
    ${estoqueMain}
  </section>

  <section id="painel-agente" class="hidden">
    <div class="agent-card">
      <h1>Gerenciar agente</h1>
      <p>Escolha a personalidade do atendente e, quando precisar, deixe um aviso temporário para a IA considerar durante as conversas.</p>

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

      <p>A IA só deve mencionar o aviso quando ele realmente fizer diferença para aquele cliente, como numa retirada ou visita no período afetado.</p>

      <div class="agent-actions">
        <button id="salvar-agente" class="agent-save" type="button">Salvar alterações</button>
      </div>
      <div id="agent-status" class="agent-status" role="status"></div>
    </div>
  </section>
</div>

<script src="js/config.js"></script>
<script src="js/auth.js"></script>
<script src="js/api.js"></script>
<script src="js/loja.js"></script>
<script src="js/components.js"></script>
<script src="js/cliente-estoque.js"></script>
<script>
const estoqueView = document.getElementById('cliente-estoque-view');
const painel = document.getElementById('painel-agente');
const tabEstoque = document.getElementById('tab-estoque');
const tabAgente = document.getElementById('tab-agente');
let lojaAgenteAtual = null;

function mostrarSecaoCliente(secao) {
  const estoque = secao === 'estoque';
  estoqueView.classList.toggle('hidden', !estoque);
  painel.classList.toggle('hidden', estoque);
  tabEstoque.classList.toggle('ativo', estoque);
  tabAgente.classList.toggle('ativo', !estoque);
}

async function carregarAgenteCliente() {
  const status = document.getElementById('agent-status');
  status.textContent = 'Carregando…';
  try {
    lojaAgenteAtual = await obterLojaAtual();
    if (!lojaAgenteAtual) throw new Error('Nenhuma loja encontrada.');
    const cfg = await apiFetch('/lojas/' + lojaAgenteAtual.id + '/cliente-agente');
    document.getElementById('personalidade').value = cfg.personalidade || 'amigavel';
    document.getElementById('aviso').value = cfg.aviso || '';
    document.getElementById('aviso-ativo').checked = Boolean(cfg.aviso_ativo);
    status.textContent = '';
  } catch (e) {
    if (e instanceof SessaoExpiradaError) return fazerLogout();
    status.textContent = e.message || 'Não foi possível carregar.';
  }
}

tabEstoque.addEventListener('click', () => mostrarSecaoCliente('estoque'));
tabAgente.addEventListener('click', async () => {
  mostrarSecaoCliente('agente');
  if (!lojaAgenteAtual) await carregarAgenteCliente();
});

document.getElementById('salvar-agente').addEventListener('click', async () => {
  const botao = document.getElementById('salvar-agente');
  const status = document.getElementById('agent-status');
  if (!lojaAgenteAtual) await carregarAgenteCliente();
  if (!lojaAgenteAtual) return;

  botao.disabled = true;
  status.textContent = 'Salvando…';
  try {
    await apiFetch('/lojas/' + lojaAgenteAtual.id + '/cliente-agente', {
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
</html>`;

fs.writeFileSync('public/cliente-estoque.html', pagina);
console.log('Correção do Estoque cliente sem iframe aplicada.');
