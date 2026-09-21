const fs = require('node:fs');

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, value) { fs.writeFileSync(path, value); }

// 1) Cadastro público fechado: não existe botão na tela de login e a rota pública devolve 403.
let authRoutes = read('src/routes/auth.routes.js');
authRoutes = authRoutes.replace(
  /router\.post\(\s*['"]\/cadastrar['"][\s\S]*?\);/,
  "router.post('/cadastrar', (_req, res) => res.status(403).json({ erro: 'Cadastro disponível somente pelo administrador.' }));"
);
write('src/routes/auth.routes.js', authRoutes);

// Qualquer acesso antigo a /painel/cadastro.html volta para o login.
write('public/cadastro.html', `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=login.html"><title>Cadastro restrito</title></head><body><p>Cadastro disponível somente pelo administrador.</p><p><a href="login.html">Voltar para o login</a></p></body></html>`);

// 2) Endpoint administrativo para criar usuário confirmado + loja.
// A service role fica somente no servidor.
let controller = read('src/controllers/admin.controller.js');
if (!controller.includes("const supabaseAuth = require('../config/supabaseAuth');")) {
  controller = controller.replace(
    "const supabase = require('../config/supabase');",
    "const supabase = require('../config/supabase');\nconst supabaseAuth = require('../config/supabaseAuth');"
  );
}

if (!controller.includes('async function criarCliente(req, res)')) {
  const fn = `
async function criarCliente(req, res) {
  const nome = String(req.body?.nome || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const senha = String(req.body?.senha || '');
  const REGEX_EMAIL = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

  if (nome.length < 2 || nome.length > 100) {
    return res.status(400).json({ erro: 'Informe um nome de loja entre 2 e 100 caracteres.' });
  }
  if (!REGEX_EMAIL.test(email) || email.length > 254) {
    return res.status(400).json({ erro: 'Informe um e-mail/login válido. Pode ser fictício, por exemplo superbac@agente.com.' });
  }
  if (senha.length < 6 || senha.length > 128) {
    return res.status(400).json({ erro: 'A senha deve ter entre 6 e 128 caracteres.' });
  }

  const prefixo = email.split('@')[0].toLowerCase();
  const username = /^[a-z0-9._-]{3,32}$/.test(prefixo) ? prefixo : undefined;

  let userId = null;
  let lojaId = null;
  try {
    const { data: criado, error: erroUsuario } = await supabaseAuth.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: username ? { username } : {},
      app_metadata: { saintsai_managed: true },
    });
    if (erroUsuario || !criado?.user?.id) {
      const msg = String(erroUsuario?.message || '');
      if (/already|registered|exists/i.test(msg)) {
        return res.status(409).json({ erro: 'Esse e-mail/login já está cadastrado.' });
      }
      throw erroUsuario || new Error('falha_criacao_usuario');
    }
    userId = criado.user.id;

    const { data: loja, error: erroLoja } = await supabase
      .from('lojas')
      .insert({ dono_id: userId, nome, ativa: true })
      .select('id, nome')
      .single();
    if (erroLoja || !loja?.id) throw erroLoja || new Error('falha_criacao_loja');
    lojaId = loja.id;

    // Começa sem acesso comercial até o administrador escolher/ativar o plano.
    await definirAssinatura(lojaId, { plano: 'trial', status: 'inativo', valido_ate: null });

    return res.status(201).json({
      cliente: { id: userId, email, username: username || null },
      loja,
      confirmado: true,
    });
  } catch (erro) {
    console.error('[admin] falha ao criar cliente:', erro?.name || 'erro');
    if (lojaId) {
      try { await supabase.from('lojas').delete().eq('id', lojaId); } catch (_) {}
    }
    if (userId) {
      try { await supabaseAuth.auth.admin.deleteUser(userId); } catch (_) {}
    }
    return res.status(500).json({ erro: 'Não foi possível cadastrar o cliente.' });
  }
}
`;
  controller = controller.replace('\nasync function operacao(req, res) {', fn + '\nasync function operacao(req, res) {');
}

controller = controller.replace(
  'module.exports = { me, listarEmpresas, atualizarAssinatura, operacao };',
  'module.exports = { me, listarEmpresas, atualizarAssinatura, criarCliente, operacao };'
);
write('src/controllers/admin.controller.js', controller);

// Rota protegida por login + exigirAdmin.
let adminRoutes = read('src/routes/admin.routes.js');
if (!adminRoutes.includes("router.post('/clientes'")) {
  adminRoutes = adminRoutes.replace(
    "router.get('/empresas', exigirAdmin, controller.listarEmpresas);",
    "router.get('/empresas', exigirAdmin, controller.listarEmpresas);\nrouter.post('/clientes', exigirAdmin, controller.criarCliente);"
  );
}
write('src/routes/admin.routes.js', adminRoutes);

// 3) Formulário dentro do painel Admin.
let adminHtml = read('public/admin.html');
if (!adminHtml.includes('id="admin-cliente-form"')) {
  const bloco = `
<section class="billing-card">
  <div class="admin-head"><h2>Cadastrar cliente</h2></div>
  <p>Somente contas criadas aqui têm acesso. O e-mail pode ser fictício e não precisa ser verificado.</p>
  <form id="admin-cliente-form" class="admin-tools" autocomplete="off">
    <label>Nome da loja
      <input id="admin-cliente-nome" type="text" minlength="2" maxlength="100" placeholder="Superbac" required>
    </label>
    <label>E-mail/login
      <input id="admin-cliente-email" type="email" maxlength="254" placeholder="superbac@agente.com" required>
    </label>
    <label>Senha inicial
      <input id="admin-cliente-senha" type="password" minlength="6" maxlength="128" autocomplete="new-password" required>
    </label>
    <button id="admin-cliente-criar" class="btn-primary" type="submit">Criar cliente</button>
  </form>
  <p id="admin-cliente-resultado" role="status"></p>
</section>
`;
  adminHtml = adminHtml.replace('<section class="billing-card"><div class="admin-head"><h2>Empresas</h2>', bloco + '<section class="billing-card"><div class="admin-head"><h2>Empresas</h2>');
}
write('public/admin.html', adminHtml);

// 4) Ação do formulário administrativo.
let adminJs = read('public/js/admin.js');
if (!adminJs.includes("document.getElementById('admin-cliente-form')")) {
  adminJs += `

document.getElementById('admin-cliente-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = document.getElementById('admin-cliente-nome').value.trim();
  const email = document.getElementById('admin-cliente-email').value.trim().toLowerCase();
  const senha = document.getElementById('admin-cliente-senha').value;
  const botao = document.getElementById('admin-cliente-criar');
  const resultado = document.getElementById('admin-cliente-resultado');
  botao.disabled = true;
  resultado.textContent = 'Criando cliente…';
  try {
    const dados = await apiFetch('/admin/clientes', {
      method: 'POST',
      body: JSON.stringify({ nome, email, senha }),
    });
    resultado.textContent = 'Cliente criado: ' + dados.cliente.email + '. Já pode entrar sem confirmar e-mail.';
    document.getElementById('admin-cliente-form').reset();
    paginaAdmin = 1;
    buscaAdmin = '';
    document.getElementById('admin-busca').value = '';
    await carregarAdmin();
  } catch (erro) {
    if (erro instanceof SessaoExpiradaError) return fazerLogout();
    resultado.textContent = erro.message || 'Não foi possível criar o cliente.';
  } finally {
    botao.disabled = false;
  }
});
`;
}
write('public/js/admin.js', adminJs);

console.log('Patch de cadastro exclusivo pelo Admin aplicado.');
