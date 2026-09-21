const fs = require('node:fs');

function replaceOnce(path, from, to) {
  let src = fs.readFileSync(path, 'utf8');
  if (!src.includes(from)) throw new Error('Trecho esperado não encontrado em ' + path);
  src = src.replace(from, to);
  fs.writeFileSync(path, src);
}

// Link visível na tela de login.
replaceOnce(
  'public/login.html',
  '      </button>\n    </form>',
  `      </button>
    </form>
    <div style="margin-top:16px;text-align:center">
      <a class="btn-secondary" href="cadastro.html" style="display:inline-flex;justify-content:center;width:100%;text-decoration:none">Criar conta</a>
    </div>`
);

// Tela de cadastro do cliente.
const cadastroHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#111111">
<link rel="manifest" href="/painel/manifest.webmanifest">
<link rel="icon" href="/painel/icons/icon-192.png">
<title>Criar conta · Vitrine</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="js/theme.js"></script>
<link rel="stylesheet" href="css/styles.css">
</head>
<body>
<div class="login-screen">
  <div class="login-card">
    <div class="login-brand brand">Vitrine</div>
    <p class="login-sub">Crie sua conta</p>
    <div id="erro-cadastro" class="error-msg hidden" role="alert"></div>
    <div id="ok-cadastro" class="success-msg hidden" role="status"></div>

    <form id="form-cadastro" novalidate>
      <div class="field">
        <label for="usuario">Nome de usuário</label>
        <input type="text" id="usuario" name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" minlength="3" maxlength="32" required>
      </div>
      <div class="field">
        <label for="email">E-mail</label>
        <input type="email" id="email" name="email" autocomplete="email" required>
      </div>
      <div class="field">
        <label for="senha">Senha</label>
        <input type="password" id="senha" name="senha" autocomplete="new-password" minlength="6" required>
      </div>
      <button type="submit" class="btn-primary" id="botao-cadastrar">
        <span id="texto-cadastrar">Criar conta</span>
      </button>
    </form>

    <div style="margin-top:16px;text-align:center">
      <a href="login.html" style="text-decoration:none">Já tenho conta · Entrar</a>
    </div>
  </div>
</div>

<script src="js/config.js"></script>
<script src="js/auth.js"></script>
<script src="js/api.js"></script>
<script>
  if (estaAutenticado()) window.location.replace('dashboard.html');

  const form = document.getElementById('form-cadastro');
  const erroBox = document.getElementById('erro-cadastro');
  const okBox = document.getElementById('ok-cadastro');
  const botao = document.getElementById('botao-cadastrar');
  const texto = document.getElementById('texto-cadastrar');

  function mostrarErro(msg) {
    okBox.classList.add('hidden');
    erroBox.textContent = msg;
    erroBox.classList.remove('hidden');
  }
  function mostrarOk(msg) {
    erroBox.classList.add('hidden');
    okBox.textContent = msg;
    okBox.classList.remove('hidden');
  }
  function carregando(v) {
    botao.disabled = v;
    texto.textContent = v ? 'Criando…' : 'Criar conta';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = document.getElementById('usuario').value.trim().toLowerCase().replace(/^@+/, '');
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;

    if (!usuario || !email || !senha) return mostrarErro('Preencha nome de usuário, e-mail e senha.');
    carregando(true);
    try {
      await apiFetch('/auth/cadastrar', {
        method: 'POST',
        body: JSON.stringify({ usuario, email, senha }),
      });
      mostrarOk('Conta criada. Se a confirmação de e-mail estiver ativa, confirme o e-mail e depois entre na conta.');
      form.reset();
      setTimeout(() => { window.location.href = 'login.html'; }, 1800);
    } catch (erro) {
      mostrarErro(erro.message || 'Não foi possível criar a conta.');
    } finally {
      carregando(false);
    }
  });
</script>
</body>
</html>`;

fs.writeFileSync('public/cadastro.html', cadastroHtml);

// Atalho no painel administrativo para o dono cadastrar um cliente manualmente.
// Abre a mesma tela de criação de conta em nova aba, sem expor credenciais administrativas.
let admin = fs.readFileSync('public/admin.html', 'utf8');
const bloco = `
<section class="card" style="margin-top:20px">
  <h2>Cadastrar cliente</h2>
  <p>Crie a conta de um novo cliente com nome de usuário, e-mail e senha.</p>
  <a class="btn-primary" href="cadastro.html" target="_blank" rel="noopener" style="display:inline-flex;text-decoration:none">Cadastrar novo cliente</a>
</section>
`;
if (!admin.includes('Cadastrar novo cliente')) {
  if (admin.includes('</main>')) admin = admin.replace('</main>', bloco + '\n</main>');
  else admin = admin.replace('</body>', bloco + '\n</body>');
}
fs.writeFileSync('public/admin.html', admin);

console.log('Patch de cadastro de clientes aplicado.');
