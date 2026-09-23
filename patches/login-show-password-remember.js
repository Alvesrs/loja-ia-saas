const fs=require('node:fs');

function rep(p,a,b){
  let s=fs.readFileSync(p,'utf8');
  if(!s.includes(a)) throw new Error('Trecho não encontrado em '+p);
  s=s.replace(a,b);
  fs.writeFileSync(p,s);
}

// Sessão: "lembrar" = localStorage; sem lembrar = sessionStorage.
rep('public/js/auth.js',
`function salvarSessao(usuario, token) {
  limparSessao();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ usuario, token }));
}

function obterSessao() {
  try {
    const bruto = localStorage.getItem(SESSION_KEY);
    return bruto ? JSON.parse(bruto) : null;
  } catch (e) {
    return null;
  }
}`,
`function salvarSessao(usuario, token, lembrar = true) {
  limparSessao();
  const storage = lembrar ? localStorage : sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify({ usuario, token }));
}

function obterSessao() {
  try {
    const bruto = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return bruto ? JSON.parse(bruto) : null;
  } catch (e) {
    return null;
  }
}`);

rep('public/js/auth.js',
`function limparSessao() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('lojaia_loja_atual');
  localStorage.removeItem('lojaia_loja_atual_id');
}`,
`function limparSessao() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('lojaia_loja_atual');
  localStorage.removeItem('lojaia_loja_atual_id');
}`);

// Login UI.
let p='public/login.html';
let s=fs.readFileSync(p,'utf8');

s=s.replace(
`<div class="field">
        <label for="senha">Senha</label>
        <input type="password" id="senha" name="senha" autocomplete="current-password" required>
      </div>
      <button type="submit" class="btn-primary" id="botao-entrar">`,
`<div class="field">
        <label for="senha">Senha</label>
        <div style="position:relative">
          <input type="password" id="senha" name="senha" autocomplete="current-password" required style="padding-right:76px">
          <button type="button" id="mostrar-senha" aria-label="Mostrar senha" aria-pressed="false" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:inherit;font:inherit;font-weight:700;padding:8px;cursor:pointer">Mostrar</button>
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:10px;margin:4px 0 16px;cursor:pointer">
        <input type="checkbox" id="lembrar-login" checked style="width:18px;height:18px">
        <span>Lembrar de mim neste aparelho</span>
      </label>
      <button type="submit" class="btn-primary" id="botao-entrar">`
);

s=s.replace(
`  const textoBotao = document.getElementById('texto-botao');`,
`  const textoBotao = document.getElementById('texto-botao');
  const senhaInput = document.getElementById('senha');
  const mostrarSenha = document.getElementById('mostrar-senha');
  const lembrarLogin = document.getElementById('lembrar-login');
  const identificadorInput = document.getElementById('identificador');
  const LOGIN_ID_KEY = 'lojaia_login_lembrado';

  try {
    const lembrado = localStorage.getItem(LOGIN_ID_KEY);
    if (lembrado) identificadorInput.value = lembrado;
  } catch (_) {}

  mostrarSenha.addEventListener('click', () => {
    const visivel = senhaInput.type === 'text';
    senhaInput.type = visivel ? 'password' : 'text';
    mostrarSenha.textContent = visivel ? 'Mostrar' : 'Ocultar';
    mostrarSenha.setAttribute('aria-label', visivel ? 'Mostrar senha' : 'Ocultar senha');
    mostrarSenha.setAttribute('aria-pressed', String(!visivel));
    senhaInput.focus();
  });`
);

s=s.replace(
`      salvarSessao(resposta.usuario, resposta.token);
      window.location.href = destinoAposLogin;`,
`      const lembrar = lembrarLogin.checked;
      salvarSessao(resposta.usuario, resposta.token, lembrar);
      try {
        if (lembrar) localStorage.setItem(LOGIN_ID_KEY, identificador);
        else localStorage.removeItem(LOGIN_ID_KEY);
      } catch (_) {}
      window.location.href = destinoAposLogin;`
);

fs.writeFileSync(p,s);
console.log('Mostrar senha e lembrar login aplicados com sessão persistente opcional.');
