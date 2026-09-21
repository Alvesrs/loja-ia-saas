const fs = require('node:fs');

function read(p){ return fs.readFileSync(p,'utf8'); }
function write(p,v){ fs.writeFileSync(p,v); }

// ---- Backend admin: clientes criados pelo próprio sistema ----
let controller = read('src/controllers/admin.controller.js');

if (!controller.includes('async function listarClientesGerenciados')) {
  const funcs = `
async function listarClientesGerenciados(req, res) {
  try {
    const usuarios = [];
    let pagina = 1;
    for (;;) {
      const { data, error } = await supabaseAuth.auth.admin.listUsers({ page: pagina, perPage: 1000 });
      if (error) throw error;
      const lote = Array.isArray(data?.users) ? data.users : [];
      usuarios.push(...lote.filter(u => u?.app_metadata?.saintsai_managed === true));
      if (lote.length < 1000) break;
      pagina += 1;
      if (pagina > 20) break;
    }

    const ids = usuarios.map(u => u.id);
    if (!ids.length) return res.json([]);

    const { data: lojas, error: erroLojas } = await supabase
      .from('lojas')
      .select('id, nome, dono_id, ativa, prompt_mestre, criado_em')
      .in('dono_id', ids)
      .order('criado_em', { ascending: false });
    if (erroLojas) throw erroLojas;

    const mapa = new Map(usuarios.map(u => [u.id, u]));
    const saida = (lojas || []).map(loja => {
      const u = mapa.get(loja.dono_id);
      return {
        loja_id: loja.id,
        nome: loja.nome,
        ativa: loja.ativa,
        email: u?.email || null,
        username: u?.user_metadata?.username || null,
        criado_em: loja.criado_em
      };
    });
    return res.json(saida);
  } catch (erro) {
    console.error('[admin] listar clientes gerenciados:', erro?.name || 'erro');
    return res.status(500).json({ erro: 'Não foi possível listar os clientes.' });
  }
}

async function obterClienteGerenciado(req, res) {
  try {
    const lojaId = String(req.params.lojaId || '');
    const { data: loja, error } = await supabase
      .from('lojas')
      .select('id, nome, dono_id, ativa, prompt_mestre, agente_personalidade, agente_aviso, agente_aviso_ativo')
      .eq('id', lojaId)
      .maybeSingle();
    if (error || !loja) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    const { data: usuario, error: erroUsuario } = await supabaseAuth.auth.admin.getUserById(loja.dono_id);
    if (erroUsuario || !usuario?.user || usuario.user.app_metadata?.saintsai_managed !== true) {
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }

    const { data: whatsapp, error: erroWa } = await supabase
      .from('whatsapp_configuracoes')
      .select('id, provedor, numero_whatsapp, identificador_externo, ativo')
      .eq('loja_id', lojaId)
      .order('criado_em', { ascending: false });
    if (erroWa) throw erroWa;

    const configWa = Array.isArray(whatsapp) ? (whatsapp.find(x => x.ativo) || whatsapp[0] || null) : null;
    return res.json({
      loja_id: loja.id,
      nome: loja.nome,
      ativa: loja.ativa,
      email: usuario.user.email || null,
      username: usuario.user.user_metadata?.username || null,
      prompt_mestre: loja.prompt_mestre || '',
      whatsapp: configWa,
      link_conectar: '/painel/login.html?next=whatsapp.html'
    });
  } catch (erro) {
    console.error('[admin] obter cliente gerenciado:', erro?.name || 'erro');
    return res.status(500).json({ erro: 'Não foi possível carregar o cliente.' });
  }
}

function separarPromptBase(prompt) {
  return String(prompt || '').replace(/\\n*\\[SAINTSAI_CONFIG_CLIENTE\\][\\s\\S]*?\\[\\/SAINTSAI_CONFIG_CLIENTE\\]\\n*/g, '\\n').trim();
}

function extrairBlocoCliente(prompt) {
  const m = String(prompt || '').match(/\\[SAINTSAI_CONFIG_CLIENTE\\][\\s\\S]*?\\[\\/SAINTSAI_CONFIG_CLIENTE\\]/);
  return m ? m[0] : '';
}

async function atualizarClienteGerenciado(req, res) {
  const lojaId = String(req.params.lojaId || '');
  const nome = String(req.body?.nome || '').trim();
  const promptBase = String(req.body?.prompt_mestre || '').trim();
  const numero = String(req.body?.numero_whatsapp || '').trim();

  if (nome.length < 2 || nome.length > 100) return res.status(400).json({ erro: 'Nome inválido.' });
  if (promptBase.length > 12000) return res.status(400).json({ erro: 'Prompt muito grande.' });
  if (numero.length > 30) return res.status(400).json({ erro: 'Número inválido.' });

  try {
    const { data: loja, error } = await supabase
      .from('lojas')
      .select('id, dono_id, prompt_mestre')
      .eq('id', lojaId)
      .maybeSingle();
    if (error || !loja) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    const { data: usuario } = await supabaseAuth.auth.admin.getUserById(loja.dono_id);
    if (!usuario?.user || usuario.user.app_metadata?.saintsai_managed !== true) {
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }

    const bloco = extrairBlocoCliente(loja.prompt_mestre);
    const promptFinal = [promptBase, bloco].filter(Boolean).join('\\n\\n');

    const { error: erroUpdate } = await supabase
      .from('lojas')
      .update({ nome, prompt_mestre: promptFinal || null })
      .eq('id', lojaId);
    if (erroUpdate) throw erroUpdate;

    if (numero) {
      const { data: existentes, error: erroList } = await supabase
        .from('whatsapp_configuracoes')
        .select('id, provedor, ativo')
        .eq('loja_id', lojaId)
        .order('criado_em', { ascending: false });
      if (erroList) throw erroList;

      const atual = Array.isArray(existentes) ? (existentes.find(x => x.ativo) || existentes[0]) : null;
      if (atual) {
        const { error: erroNumero } = await supabase
          .from('whatsapp_configuracoes')
          .update({ numero_whatsapp: numero })
          .eq('id', atual.id)
          .eq('loja_id', lojaId);
        if (erroNumero) throw erroNumero;
      }
    }

    return res.json({ ok: true });
  } catch (erro) {
    console.error('[admin] atualizar cliente gerenciado:', erro?.name || 'erro');
    return res.status(500).json({ erro: 'Não foi possível salvar o cliente.' });
  }
}
`;
  controller = controller.replace('\nasync function operacao(req, res) {', funcs + '\nasync function operacao(req, res) {');
}

// Normaliza exports independentemente da ordem atual.
controller = controller.replace(
  /module\.exports\s*=\s*\{([^}]+)\};/,
  (m, inner) => {
    const nomes = inner.split(',').map(s => s.trim()).filter(Boolean);
    for (const n of ['listarClientesGerenciados','obterClienteGerenciado','atualizarClienteGerenciado']) {
      if (!nomes.includes(n)) nomes.push(n);
    }
    return 'module.exports = { ' + nomes.join(', ') + ' };';
  }
);
write('src/controllers/admin.controller.js', controller);

let routes = read('src/routes/admin.routes.js');
if (!routes.includes("router.get('/clientes-gerenciados'")) {
  routes = routes.replace(
    "router.post('/clientes', exigirAdmin, controller.criarCliente);",
    "router.post('/clientes', exigirAdmin, controller.criarCliente);\n" +
    "router.get('/clientes-gerenciados', exigirAdmin, controller.listarClientesGerenciados);\n" +
    "router.get('/clientes-gerenciados/:lojaId', exigirAdmin, controller.obterClienteGerenciado);\n" +
    "router.put('/clientes-gerenciados/:lojaId', exigirAdmin, controller.atualizarClienteGerenciado);"
  );
}
write('src/routes/admin.routes.js', routes);

// ---- Página Admin: seção Clientes ----
let adminHtml = read('public/admin.html');
if (!adminHtml.includes('id="admin-clientes-gerenciados"')) {
  const bloco = `
<section class="billing-card" id="admin-clientes-gerenciados" style="margin-top:20px">
  <div class="admin-head">
    <div>
      <h2>Clientes</h2>
      <p>Contas de estoque criadas por você. Toque em um cliente para configurar o agente e o WhatsApp.</p>
    </div>
  </div>
  <div id="admin-clientes-lista"><p>Carregando clientes…</p></div>
</section>
`;
  adminHtml = adminHtml.replace('</main>', bloco + '\n</main>');
}
write('public/admin.html', adminHtml);

let adminJs = read('public/js/admin.js');
if (!adminJs.includes('async function carregarClientesGerenciados')) {
  adminJs += `

function escaparClienteHtml(v) {
  const d = document.createElement('div');
  d.textContent = v == null ? '' : String(v);
  return d.innerHTML;
}

async function carregarClientesGerenciados() {
  const box = document.getElementById('admin-clientes-lista');
  if (!box) return;
  try {
    const clientes = await apiFetch('/admin/clientes-gerenciados');
    if (!Array.isArray(clientes) || !clientes.length) {
      box.innerHTML = '<p>Nenhum cliente cadastrado ainda.</p>';
      return;
    }
    box.innerHTML = clientes.map(c => `
      <a href="admin-cliente.html?loja=${encodeURIComponent(c.loja_id)}"
         style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 0;border-bottom:1px solid rgba(127,127,127,.18);text-decoration:none;color:inherit">
        <div>
          <strong>${escaparClienteHtml(c.nome)}</strong>
          <div style="opacity:.7;font-size:13px;margin-top:4px">${escaparClienteHtml(c.email || c.username || '')}</div>
        </div>
        <span>Gerenciar ›</span>
      </a>
    `).join('');
  } catch (erro) {
    if (erro instanceof SessaoExpiradaError) return fazerLogout();
    box.innerHTML = '<p>Não foi possível carregar os clientes.</p>';
  }
}

carregarClientesGerenciados();
`;

  adminJs = adminJs.replace(
    "await carregarAdmin();\n  } catch (erro) {",
    "await carregarAdmin();\n    await carregarClientesGerenciados();\n  } catch (erro) {"
  );
}
write('public/js/admin.js', adminJs);

// ---- Tela individual do cliente ----
write('public/admin-cliente.html', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover">
<meta name="theme-color" content="#08070d">
<title>Cliente · SaintsAI</title>
<link rel="stylesheet" href="css/styles.css">
<script src="js/theme.js"></script>
<script src="js/guard.js"></script>
<style>
.client-admin{max-width:760px;margin:0 auto;padding:20px 16px 50px}
.client-admin-head{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.client-admin-card{background:var(--surface,#111018);border:1px solid rgba(150,90,240,.24);border-radius:20px;padding:18px;margin-bottom:16px}
.client-admin-card h2{margin-top:0}
.client-admin-grid{display:grid;gap:14px}
.client-admin-grid label{display:flex;flex-direction:column;gap:7px;font-weight:700}
.client-admin-grid input,.client-admin-grid textarea{width:100%;box-sizing:border-box}
.client-admin-grid textarea{min-height:180px}
.client-wa-status{padding:12px;border-radius:14px;background:rgba(127,127,127,.08);margin:10px 0}
.client-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
</style>
</head>
<body>
<main class="client-admin">
  <div class="client-admin-head">
    <a href="admin.html" class="btn-secondary small" style="text-decoration:none">← Admin</a>
    <div><h1 id="cliente-titulo" style="margin:0">Cliente</h1><p id="cliente-login" style="margin:4px 0 0;opacity:.7"></p></div>
  </div>

  <div id="cliente-erro" class="error-msg hidden"></div>

  <section class="client-admin-card">
    <h2>Dados e agente</h2>
    <div class="client-admin-grid">
      <label>Nome do cliente / loja
        <input id="cliente-nome" type="text" maxlength="100">
      </label>
      <label>Prompt Mestre
        <textarea id="cliente-prompt" maxlength="12000" placeholder="Defina como o agente deve atender, políticas da loja, entregas, trocas etc."></textarea>
      </label>
    </div>
  </section>

  <section class="client-admin-card">
    <h2>WhatsApp do cliente</h2>
    <div id="cliente-wa-status" class="client-wa-status">Carregando…</div>
    <div class="client-admin-grid">
      <label>Número do WhatsApp
        <input id="cliente-numero" type="tel" maxlength="30" placeholder="+55 41 99999-9999">
      </label>
    </div>
    <div class="client-actions">
      <button id="cliente-salvar" class="btn-primary" type="button">Salvar configurações</button>
      <button id="cliente-link" class="btn-secondary" type="button">Copiar link para conectar Meta</button>
    </div>
    <p style="opacity:.72">O link abre o login do cliente e depois leva direto à conexão oficial do WhatsApp/Meta. Assim a integração fica vinculada à conta correta.</p>
    <div id="cliente-status" role="status"></div>
  </section>
</main>

<script src="js/config.js"></script>
<script src="js/auth.js"></script>
<script src="js/api.js"></script>
<script>
const params = new URLSearchParams(location.search);
const lojaId = params.get('loja');
let clienteDados = null;

function erro(msg) {
  const box = document.getElementById('cliente-erro');
  box.textContent = msg;
  box.classList.remove('hidden');
}

async function carregar() {
  if (!lojaId) return erro('Cliente inválido.');
  try {
    clienteDados = await apiFetch('/admin/clientes-gerenciados/' + encodeURIComponent(lojaId));
    document.getElementById('cliente-titulo').textContent = clienteDados.nome;
    document.getElementById('cliente-login').textContent = clienteDados.email || clienteDados.username || '';
    document.getElementById('cliente-nome').value = clienteDados.nome || '';
    document.getElementById('cliente-prompt').value = String(clienteDados.prompt_mestre || '').replace(/\\n*\\[SAINTSAI_CONFIG_CLIENTE\\][\\s\\S]*?\\[\\/SAINTSAI_CONFIG_CLIENTE\\]\\n*/g, '\\n').trim();
    document.getElementById('cliente-numero').value = clienteDados.whatsapp?.numero_whatsapp || '';
    document.getElementById('cliente-wa-status').textContent = clienteDados.whatsapp?.ativo
      ? 'WhatsApp conectado: ' + (clienteDados.whatsapp.numero_whatsapp || 'número configurado')
      : 'WhatsApp ainda não conectado à Meta.';
  } catch (e) {
    if (e instanceof SessaoExpiradaError) return fazerLogout();
    erro(e.message || 'Não foi possível carregar o cliente.');
  }
}

document.getElementById('cliente-salvar').addEventListener('click', async () => {
  const status = document.getElementById('cliente-status');
  status.textContent = 'Salvando…';
  try {
    await apiFetch('/admin/clientes-gerenciados/' + encodeURIComponent(lojaId), {
      method: 'PUT',
      body: JSON.stringify({
        nome: document.getElementById('cliente-nome').value.trim(),
        prompt_mestre: document.getElementById('cliente-prompt').value.trim(),
        numero_whatsapp: document.getElementById('cliente-numero').value.trim()
      })
    });
    status.textContent = 'Configurações salvas.';
    await carregar();
  } catch (e) {
    if (e instanceof SessaoExpiradaError) return fazerLogout();
    status.textContent = e.message || 'Não foi possível salvar.';
  }
});

document.getElementById('cliente-link').addEventListener('click', async () => {
  const status = document.getElementById('cliente-status');
  const link = location.origin + '/painel/login.html?next=whatsapp.html';
  try {
    await navigator.clipboard.writeText(link);
    status.textContent = 'Link copiado. Envie ao cliente junto com o login criado no Admin.';
  } catch (_) {
    status.textContent = link;
  }
});

carregar();
</script>
</body>
</html>`);

console.log('Patch de gestão individual de clientes aplicado.');
