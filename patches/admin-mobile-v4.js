const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8');}
function write(p,s){fs.writeFileSync(p,s);}

let html=read('public/admin-mobile.html');

// 1) Força o WebView a abandonar caches/service workers antigos do painel admin.
html=html.replace(
  '<meta name="theme-color" content="#090812"><title>Agente SaintsAI · Admin</title>',
  '<meta name="theme-color" content="#090812"><meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate"><meta http-equiv="Pragma" content="no-cache"><meta http-equiv="Expires" content="0"><title>Agente SaintsAI · Admin</title>'
);
html=html.replace(
  '<script src="js/config.js"></script><script src="js/auth.js"></script><script src="js/api.js"></script>',
  '<script>window.SAINTSAI_ADMIN_UI_VERSION="v4";(async()=>{try{if("serviceWorker"in navigator){const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.unregister()));}if("caches"in window){const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));}}catch(_){}})();</script><script src="js/config.js?v=4"></script><script src="js/auth.js?v=4"></script><script src="js/api.js?v=4"></script>'
);

// 2) Menus expansíveis dentro do drawer para Clientes e Estoque.
html=html.replace(
  '<button data-view="clientes">👥 MEUS CLIENTES</button>\n  <button data-view="estoque">📦 ESTOQUE</button>',
  '<div class="navGroup"><button id="clientesMenuBtn" type="button">👥 MEUS CLIENTES <span class="navChevron">▾</span></button><div id="clientesSubmenu" class="navSub hidden"><div class="navSubLoading">Carregando clientes…</div></div></div>\n  <div class="navGroup"><button id="estoqueMenuBtn" type="button">📦 ESTOQUE <span class="navChevron">▾</span></button><div id="estoqueSubmenu" class="navSub hidden"><div class="navSubLoading">Carregando clientes…</div></div></div>'
);
html=html.replace(
  '<button id="configBtn">⚙ CONFIGURAÇÕES</button>',
  '<button data-view="config">⚙ CONFIGURAÇÕES</button>'
);

// 3) Configurações deixa de abrir o sistema legado.
html=html.replace(
  '<section id="view-assinaturas" class="view hidden"><div class="card"><h2>Assinaturas</h2><p class="sub">Escolha um cliente em “Meus Clientes” para gerenciar o plano e a assinatura dele.</p><button class="btn secondary" data-go="clientes">Selecionar cliente</button></div></section>',
  '<section id="view-assinaturas" class="view hidden"><div class="card"><h2>Assinaturas</h2><p class="sub">Escolha um cliente em “Meus Clientes” para gerenciar o plano e a assinatura dele.</p><button class="btn secondary" data-go="clientes">Selecionar cliente</button></div></section>\n<section id="view-config" class="view hidden"><div class="card"><h2>Configurações</h2><p class="sub">Configurações do painel Agente SaintsAI.</p><div class="field"><label>Tema</label><select id="adminTheme"><option value="dark">Escuro</option><option value="light">Claro</option><option value="system">Sistema</option></select></div><button id="sairAdmin" class="btn secondary" type="button">Sair da conta</button></div></section>'
);

// 4) CSS dos submenus.
html=html.replace(
  '.nav{display:grid;gap:8px}.nav button{width:100%;text-align:left;padding:13px 14px;border:0;border-radius:13px;color:#eee8ff;font-weight:900;background:rgba(255,255,255,.025);font:inherit}.nav button.active{background:linear-gradient(135deg,rgba(124,58,237,.75),rgba(109,40,217,.75))}',
  '.nav{display:grid;gap:8px}.nav button{width:100%;text-align:left;padding:13px 14px;border:0;border-radius:13px;color:#eee8ff;font-weight:900;background:rgba(255,255,255,.025);font:inherit}.nav button.active{background:linear-gradient(135deg,rgba(124,58,237,.75),rgba(109,40,217,.75))}.navGroup{display:grid;gap:5px}.navChevron{float:right;color:#b99cff}.navSub{display:grid;gap:5px;padding:2px 4px 4px 14px}.navSub button{padding:10px 11px;font-size:13px;background:#0c0b13;border:1px solid rgba(185,156,255,.12)}.navSub button small{display:block;color:#aaa5b7;font-size:11px;margin-top:2px}.navSubLoading{font-size:12px;color:#aaa5b7;padding:8px 10px}'
);

// 5) Views/títulos e comportamento do menu.
html=html.replace(
  "const titles={clientes:['Meus clientes','Selecione quem você deseja configurar'],estoque:['Estoque','Escolha o cliente e abra o estoque dele'],registro:['Registrar novo cliente','Crie e ative um novo cliente na SaintsAI'],teste:['Registro Teste','Teste sem pagamento'],assinaturas:['Assinaturas','Gerencie planos dos seus clientes']};",
  "const titles={clientes:['Meus clientes','Selecione quem você deseja configurar'],estoque:['Estoque','Escolha o cliente e abra o estoque dele'],registro:['Registrar novo cliente','Crie e ative um novo cliente na SaintsAI'],teste:['Registro Teste','Teste sem pagamento'],assinaturas:['Assinaturas','Gerencie planos dos seus clientes'],config:['Configurações','Preferências do Agente SaintsAI']};"
);
html=html.replace(
  "$('menuBtn').onclick=openDrawer;$('drawerBg').onclick=closeDrawer;document.querySelectorAll('.nav button[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go));$('configBtn').onclick=()=>location.href='configuracoes.html';",
  "$('menuBtn').onclick=openDrawer;$('drawerBg').onclick=closeDrawer;document.querySelectorAll('.nav button[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go));\n$('clientesMenuBtn').onclick=()=>{$('clientesSubmenu').classList.toggle('hidden')};$('estoqueMenuBtn').onclick=()=>{$('estoqueSubmenu').classList.toggle('hidden')};"
);

// 6) Renderiza os clientes também nos submenus do drawer.
html=html.replace(
  "document.querySelectorAll('[data-config]').forEach(b=>b.onclick=()=>location.href='admin-cliente.html?loja='+encodeURIComponent(b.dataset.config));\n document.querySelectorAll('[data-stock]').forEach(b=>b.onclick=()=>{const c=clientesCache.find(x=>x.loja_id===b.dataset.stock);if(c)chooseStore(c);location.href='admin-estoque.html?loja='+encodeURIComponent(b.dataset.stock)});",
  "document.querySelectorAll('[data-config]').forEach(b=>b.onclick=()=>location.href='admin-cliente.html?loja='+encodeURIComponent(b.dataset.config));\n document.querySelectorAll('[data-stock]').forEach(b=>b.onclick=()=>{const c=clientesCache.find(x=>x.loja_id===b.dataset.stock);if(c)chooseStore(c);location.href='admin-estoque.html?loja='+encodeURIComponent(b.dataset.stock)});\n const csub=$('clientesSubmenu'),esub=$('estoqueSubmenu');if(csub)csub.innerHTML=clientesCache.length?clientesCache.map(c=>'<button type=\"button\" data-drawer-config=\"'+c.loja_id+'\"><strong>'+esc(c.nome)+'</strong><small>Configurar cliente</small></button>').join(''):'<div class=\"navSubLoading\">Nenhum cliente cadastrado</div>';if(esub)esub.innerHTML=clientesCache.length?clientesCache.map(c=>'<button type=\"button\" data-drawer-stock=\"'+c.loja_id+'\"><strong>'+esc(c.nome)+'</strong><small>Abrir estoque sincronizado</small></button>').join(''):'<div class=\"navSubLoading\">Nenhum cliente cadastrado</div>';document.querySelectorAll('[data-drawer-config]').forEach(b=>b.onclick=()=>location.href='admin-cliente.html?loja='+encodeURIComponent(b.dataset.drawerConfig));document.querySelectorAll('[data-drawer-stock]').forEach(b=>b.onclick=()=>{const c=clientesCache.find(x=>x.loja_id===b.dataset.drawerStock);if(c)chooseStore(c);location.href='admin-estoque.html?loja='+encodeURIComponent(b.dataset.drawerStock)});"
);

// 7) Configurações internas funcionais.
html=html.replace(
  "loadClients();const initial=(location.hash||'#registro').slice(1);showView(titles[initial]?initial:'registro');",
  "const th=$('adminTheme');if(th){th.value=localStorage.getItem('saintsai_admin_theme')||'dark';th.onchange=()=>{localStorage.setItem('saintsai_admin_theme',th.value);if(window.LojaIATheme&&window.LojaIATheme.setTheme)window.LojaIATheme.setTheme(th.value)}}const so=$('sairAdmin');if(so)so.onclick=()=>fazerLogout();loadClients();const initial=(location.hash||'#registro').slice(1);showView(titles[initial]?initial:'registro');"
);

// 8) Cabeçalhos explícitos no-store.
write('public/admin-mobile.html',html);

// O admin antigo nunca mais deve abrir interface antiga.
write('public/admin.html','<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Cache-Control" content="no-store"><script>location.replace("admin-mobile.html?v=4#clientes")</script></head><body></body></html>');

// Página de configurações legada também volta ao painel novo.
write('public/configuracoes.html','<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Cache-Control" content="no-store"><script>location.replace("admin-mobile.html?v=4#config")</script></head><body></body></html>');

// Admin Estoque: usa a MESMA página estoque.html e portanto os mesmos endpoints/dados do app do cliente.
// A loja escolhida é gravada em todos os caches conhecidos e passada na query para reforçar seleção.
let estoque=read('public/admin-estoque.html');
estoque=estoque.replace("document.getElementById('f').src='estoque.html';",
  "try{localStorage.setItem('lojaia_loja_atual_id',id);localStorage.setItem('lojaia_loja_atual',JSON.stringify({id:id}));localStorage.setItem('loja_ia_loja_atual',JSON.stringify({id:id}));sessionStorage.setItem('lojaia_loja_atual_id',id);sessionStorage.setItem('lojaia_loja_atual',JSON.stringify({id:id}));sessionStorage.setItem('loja_ia_loja_atual',JSON.stringify({id:id}));}catch(_){}document.getElementById('f').src='estoque.html?loja='+encodeURIComponent(id)+'&admin=1&v=4';");
write('public/admin-estoque.html',estoque);

// Neutraliza cache do service worker do painel para não ressuscitar HTML antigo.
if(fs.existsSync('public/service-worker.js')){
 let sw=read('public/service-worker.js');
 sw="const SAINTSAI_ADMIN_CACHE_BUSTER='v4';\n"+sw;
 sw=sw.replace(/const CACHE_NAME\s*=\s*['\"][^'\"]+['\"]/,'const CACHE_NAME = "saintsai-v4"');
 write('public/service-worker.js',sw);
}

console.log('Admin mobile v4 aplicado: submenus, configurações internas, estoque sincronizado e cache antigo neutralizado.');
