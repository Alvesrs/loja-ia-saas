const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..', 'public');

test('10W/PWA) manifest torna o painel instalável em modo standalone', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, '/painel/dashboard.html');
  assert.ok(m.icons.some((i) => i.sizes === '192x192'));
  assert.ok(m.icons.some((i) => i.sizes === '512x512'));
});

test('10W/PWA) service worker não intercepta/cacheia API', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
  const listeners=new Map();let intercepted=0,cacheReads=0;
  require('node:vm').runInNewContext(sw,{self:{location:{origin:'https://fixture.test'},addEventListener:(name,fn)=>listeners.set(name,fn),skipWaiting(){},clients:{claim(){}}},URL,caches:{match(){cacheReads++;throw Error('API must not use cache');},keys:async()=>[]},fetch(){throw Error('API must remain with the page network request');}});
  listeners.get('fetch')?.({request:{method:'GET',url:'https://fixture.test/api/lojas/private'},respondWith(){intercepted++;}});
  assert.equal(intercepted,0);assert.equal(cacheReads,0);
});

test('10W/PWA) páginas principais apontam para o manifest', () => {
  for (const nome of ['login.html','dashboard.html','atendente.html','whatsapp.html']) {
    assert.match(fs.readFileSync(path.join(ROOT, nome), 'utf8'), /manifest\.webmanifest/);
  }
});


test('10W/PWA) painel oferece fluxo nativo de instalação quando o navegador disponibiliza', () => {
  const layout = fs.readFileSync(path.join(ROOT, 'js', 'layout.js'), 'utf8');
  assert.match(layout, /beforeinstallprompt/);
  assert.match(layout, /botao-instalar-app/);
  assert.match(layout, /eventoInstalacaoPwa\.prompt\(\)/);
});
