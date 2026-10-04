const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function carregar(fetch) {
  let destino = null, alerta = null;
  const btn = { disabled: false, classList: { add() {} }, setAttribute() {}, removeAttribute() {} };
  const versao = {}, android = {};
  const document = { readyState: 'complete', getElementById: id => ({ 'saintsai-update-fixed': btn, 'saintsai-update-version': versao, 'native-update': android })[id] };
  const context = { document, window: {}, fetch, URL, Date, location: { href: 'https://app.example/cliente/cliente-central.html?loja=123', replace: url => { destino = url; } }, setTimeout: f => f(), alert: msg => { alerta = msg; } };
  vm.runInNewContext(fs.readFileSync('public/js/cliente-atualizacao.js', 'utf8'), context);
  return { btn, android, executar: () => btn.onclick(), destino: () => destino, alerta: () => alerta };
}
test('botão atualiza a tela preservando a loja e evitando cache, sem baixar APK', async () => {
  const c = carregar(async (url, opts) => { assert.equal(url, 'versao.json'); assert.equal(opts.cache, 'no-store'); return { ok: true, json: async () => ({ versao: '2026.10.04.1' }) }; });
  await c.executar();
  const destino = new URL(c.destino());
  assert.equal(destino.pathname, '/cliente/cliente-central.html'); assert.equal(destino.searchParams.get('loja'), '123');
  assert.equal(destino.searchParams.get('atualizacao'), '2026.10.04.1'); assert.ok(destino.searchParams.get('recarregar'));
  assert.equal(c.android.textContent, 'Atualizar Android');
});
test('sem conexão mantém a tela e permite tentar novamente', async () => {
  const c = carregar(async () => { throw new Error('offline'); });
  await c.executar(); assert.equal(c.destino(), null); assert.equal(c.btn.disabled, false); assert.match(c.alerta(), /conexão/);
});
test('resposta inválida da versão não muda a navegação do app', async () => {
  const c = carregar(async () => ({ ok: true, json: async () => ({}) }));
  await c.executar(); assert.equal(c.destino(), null); assert.equal(c.btn.disabled, false);
});
