const fs = require('node:fs');

function replaceOnce(path, from, to) {
  let src = fs.readFileSync(path, 'utf8');
  if (!src.includes(from)) throw new Error('Trecho esperado não encontrado em ' + path);
  src = src.replace(from, to);
  fs.writeFileSync(path, src);
}

// 1) Rate limiter usa o identificador (email ou usuário), preservando compatibilidade.
replaceOnce(
  'src/routes/auth.routes.js',
  "obterChave: (req) => `${req.ip}:${String(req.body?.email || '').trim().toLowerCase()}`,",
  "obterChave: (req) => `${req.ip}:${String(req.body?.identificador || req.body?.email || '').trim().toLowerCase()}`,"
);

// 2) Backend: resolve email ou nome de usuário usando o Supabase Auth.
// Contas antigas também podem usar, quando não ambíguo, o trecho antes do @.
replaceOnce(
  'src/controllers/auth.controller.js',
  "const REGEX_EMAIL_BASICO = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;\n",
  `const REGEX_EMAIL_BASICO = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const REGEX_USUARIO = /^[a-z0-9._-]{3,32}$/;

function normalizarUsuario(valor) {
  return String(valor || '').trim().toLowerCase().replace(/^@+/, '');
}

async function listarUsuariosAuth() {
  const todos = [];
  const porPagina = 1000;
  for (let pagina = 1; pagina <= 10; pagina += 1) {
    const { data, error } = await supabaseAuth.auth.admin.listUsers({
      page: pagina,
      perPage: porPagina,
    });
    if (error) throw error;
    const usuarios = Array.isArray(data && data.users) ? data.users : [];
    todos.push(...usuarios);
    if (usuarios.length < porPagina) break;
  }
  return todos;
}

async function resolverEmailPorIdentificador(valor) {
  const identificador = String(valor || '').trim();
  if (!identificador) return null;
  if (REGEX_EMAIL_BASICO.test(identificador)) return identificador.toLowerCase();

  const alvo = normalizarUsuario(identificador);
  if (!REGEX_USUARIO.test(alvo)) return null;

  const usuarios = await listarUsuariosAuth();
  const encontrados = usuarios.filter((u) => {
    const email = String(u.email || '').trim().toLowerCase();
    const metadata = u.user_metadata || {};
    const usuarioDefinido = normalizarUsuario(metadata.username || metadata.usuario);
    const prefixoEmail = email.includes('@') ? normalizarUsuario(email.split('@')[0]) : '';
    return usuarioDefinido === alvo || prefixoEmail === alvo;
  }).filter((u) => Boolean(u.email));

  if (encontrados.length !== 1) return null;
  return String(encontrados[0].email).trim().toLowerCase();
}

async function usuarioJaExiste(usuario) {
  const alvo = normalizarUsuario(usuario);
  if (!REGEX_USUARIO.test(alvo)) return true;
  const usuarios = await listarUsuariosAuth();
  return usuarios.some((u) => {
    const metadata = u.user_metadata || {};
    return normalizarUsuario(metadata.username || metadata.usuario) === alvo;
  });
}
`
);

replaceOnce(
  'src/controllers/auth.controller.js',
  "  const { email, senha } = req.body || {};",
  "  const { email, senha, usuario } = req.body || {};"
);

replaceOnce(
  'src/controllers/auth.controller.js',
  "  const { data, error } = await supabaseAuth.auth.signUp({ email: email.trim(), password: senha });",
  `  const usuarioNormalizado = normalizarUsuario(usuario);
  if (usuario && !REGEX_USUARIO.test(usuarioNormalizado)) {
    return res.status(400).json({ erro: 'O nome de usuário deve ter de 3 a 32 caracteres e usar apenas letras, números, ponto, hífen ou underline.' });
  }
  if (usuarioNormalizado && await usuarioJaExiste(usuarioNormalizado)) {
    return res.status(409).json({ erro: 'Este nome de usuário já está em uso.' });
  }

  const dadosCadastro = { email: email.trim(), password: senha };
  if (usuarioNormalizado) {
    dadosCadastro.options = { data: { username: usuarioNormalizado } };
  }
  const { data, error } = await supabaseAuth.auth.signUp(dadosCadastro);`
);

// Substitui apenas a função login, mantendo cadastro e tratamento seguro intactos.
const controllerPath = 'src/controllers/auth.controller.js';
let controller = fs.readFileSync(controllerPath, 'utf8');
const inicio = controller.indexOf('async function login(req, res) {');
const fim = controller.indexOf('\nfunction seguro(handler)', inicio);
if (inicio < 0 || fim < 0) throw new Error('Função login não localizada.');
const novoLogin = `async function login(req, res) {
  const { identificador, email, senha } = req.body || {};
  const entrada = String(identificador || email || '').trim();

  if (!ehStringNaoVazia(entrada) || !ehStringNaoVazia(senha)) {
    return res.status(400).json({ erro: 'Informe e-mail ou nome de usuário e senha.' });
  }

  const emailResolvido = await resolverEmailPorIdentificador(entrada);
  if (!emailResolvido) {
    return res.status(401).json({ erro: 'Não foi possível entrar. Confira seus dados.' });
  }

  const { data, error } = await supabaseAuth.auth.signInWithPassword({
    email: emailResolvido,
    password: senha,
  });

  if (error || !data || !data.session) {
    return res.status(401).json({ erro: 'Não foi possível entrar. Confira seus dados.' });
  }

  return res.json({
    usuario: data.user,
    token: data.session.access_token,
  });
}
`;
controller = controller.slice(0, inicio) + novoLogin + controller.slice(fim);
fs.writeFileSync(controllerPath, controller);

// 3) Tela de login.
replaceOnce(
  'public/login.html',
  `        <label for="email">Email</label>
        <input type="email" id="email" name="email" autocomplete="username" required>`,
  `        <label for="identificador">E-mail ou nome de usuário</label>
        <input type="text" id="identificador" name="identificador" autocomplete="username" autocapitalize="none" spellcheck="false" required>`
);

replaceOnce(
  'public/login.html',
  "    const email = document.getElementById('email').value.trim();",
  "    const identificador = document.getElementById('identificador').value.trim();"
);
replaceOnce(
  'public/login.html',
  "    if (!email || !senha) {\n      mostrarErro('Preencha email e senha.');",
  "    if (!identificador || !senha) {\n      mostrarErro('Preencha e-mail ou nome de usuário e senha.');"
);
replaceOnce(
  'public/login.html',
  "        body: JSON.stringify({ email, senha }),",
  "        body: JSON.stringify({ identificador, senha }),"
);

// 4) Permite link dedicado para o cliente: login.html?next=whatsapp.html.
let loginHtml = fs.readFileSync('public/login.html', 'utf8');
loginHtml = loginHtml.replace(
  "  // Se já existe sessão válida, não faz sentido mostrar o login de novo.\n  if (estaAutenticado()) {\n    window.location.replace('dashboard.html');\n  }",
  `  const nextParam = new URLSearchParams(window.location.search).get('next');
  const destinoPermitido = ['dashboard.html', 'whatsapp.html', 'admin.html'];
  const destinoAposLogin = destinoPermitido.includes(nextParam) ? nextParam : 'dashboard.html';

  // Se já existe sessão válida, segue para o destino solicitado.
  if (estaAutenticado()) {
    window.location.replace(destinoAposLogin);
  }`
);
loginHtml = loginHtml.replace(
  "      window.location.href = 'dashboard.html';",
  "      window.location.href = destinoAposLogin;"
);
fs.writeFileSync('public/login.html', loginHtml);

console.log('Patch de login por email ou usuário aplicado.');
