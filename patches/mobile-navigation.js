const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8');}
function write(p,s){fs.writeFileSync(p,s);}

let l=read('public/js/layout.js');

if(!l.includes("configuracoes: '<svg")) {
  l=l.replace(
    "  sair: '<svg",
    "  configuracoes: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.3 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1A1.7 1.7 0 0 0 19.4 9c.3.6.9 1 1.6 1h.1v4H21c-.7 0-1.3.4-1.6 1Z"/></svg>',\n  sair: '<svg"
  );
}

const oldTab=`function montarTabbar(paginaAtiva, admin = false) {
  const itens = menuVisivel(admin).map((item) => \`
    <a href="\${item.href}" class="\${item.id === paginaAtiva ? 'active' : ''}">
      \${ICONES[item.id] || ICONES.onboarding}
      <span>\${item.label.split(' ')[0]}</span>
    </a>\`).join('');
  return \`<nav class="tabbar">\${itens}</nav>\`;
}`;

const newTab=`function montarTabbar(paginaAtiva, admin = false) {
  const itens = admin
    ? [
        { id:'dashboard', label:'Início', href:'dashboard.html' },
        { id:'admin', label:'Clientes', href:'admin.html' },
        { id:'pedidos', label:'Pedidos', href:'pedidos.html' },
        { id:'configuracoes', label:'Configurações', href:'configuracoes.html' },
      ]
    : [
        { id:'dashboard', label:'Início', href:'dashboard.html' },
        { id:'produtos', label:'Produtos', href:'produtos.html' },
        { id:'pedidos', label:'Pedidos', href:'pedidos.html' },
        { id:'configuracoes', label:'Configurações', href:'configuracoes.html' },
      ];

  const ativo = (paginaAtiva === 'admin-cliente' || paginaAtiva === 'onboarding') ? 'admin' : paginaAtiva;
  return '<nav class="tabbar tabbar-principal">' + itens.map((item) => \`
    <a href="\${item.href}" class="\${item.id === ativo ? 'active' : ''}">
      \${ICONES[item.id] || ICONES.onboarding}
      <span>\${item.label}</span>
    </a>\`).join('') + '</nav>';
}`;

if(!l.includes(oldTab)) throw new Error('montarTabbar original não encontrado');
l=l.replace(oldTab,newTab);
write('public/js/layout.js',l);

let css=read('public/css/styles.css');
if(!css.includes('/* SaintsAI mobile navigation */')) {
css += `

/* SaintsAI mobile navigation */
@media (max-width: 859px) {
  .tabbar.tabbar-principal {
    display:grid;
    grid-template-columns:repeat(4,minmax(0,1fr));
    gap:0;
    padding:7px 4px calc(7px + env(safe-area-inset-bottom));
    min-height:64px;
    overflow:visible;
  }
  .tabbar.tabbar-principal a {
    min-width:0;
    width:100%;
    padding:7px 2px;
    gap:4px;
    font-size:10.5px;
    white-space:normal;
    line-height:1.1;
    text-align:center;
  }
  .tabbar.tabbar-principal a svg { width:20px; height:20px; }
  .main-col, .page { padding-bottom:calc(76px + env(safe-area-inset-bottom)); }
}
`;
write('public/css/styles.css',css);
}

const cfg=`<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover"><meta name="theme-color" content="#111111">
<link rel="manifest" href="/painel/manifest.webmanifest"><link rel="icon" href="/painel/icons/icon-192.png">
<title>Configurações · SaintsAI</title><link rel="stylesheet" href="css/styles.css"><script src="js/theme.js"></script><script src="js/guard.js"></script>
<style>
.cfg-grid{display:grid;gap:12px}.cfg-link{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--surface);text-decoration:none;color:inherit}.cfg-link strong{display:block}.cfg-link small{display:block;opacity:.68;margin-top:4px}.cfg-section{margin-bottom:20px}
</style></head>
<body data-page="configuracoes"><div class="app-shell"><div id="sidebar-container"></div><div class="main-col"><div id="topbar-container"></div>
<main class="page"><h1 class="page-title">Configurações</h1><p class="page-sub">Acessos menos usados ficam organizados aqui.</p>
<section class="cfg-section"><div class="cfg-grid">
<a class="cfg-link" href="atendente.html"><div><strong>IA e Prompt Mestre</strong><small>Comportamento e testes do atendente</small></div><span>›</span></a>
<a class="cfg-link" href="whatsapp.html"><div><strong>WhatsApp</strong><small>Conexão e conversas</small></div><span>›</span></a>
<a class="cfg-link" href="plano.html"><div><strong>Plano</strong><small>Assinatura e uso</small></div><span>›</span></a>
<a class="cfg-link" href="produtos.html"><div><strong>Produtos</strong><small>Cadastro de catálogo</small></div><span>›</span></a>
<a class="cfg-link" href="estoque.html"><div><strong>Estoque</strong><small>Quantidades e variações</small></div><span>›</span></a>
<a class="cfg-link" href="ajuda.html"><div><strong>Ajuda</strong><small>Orientações do sistema</small></div><span>›</span></a>
</div></section>
</main></div><div id="tabbar-container"></div></div>
<script src="js/config.js"></script><script src="js/auth.js"></script><script src="js/api.js"></script><script src="js/loja.js"></script><script src="js/components.js"></script><script src="js/layout.js"></script>
<script>montarLayout('configuracoes');</script></body></html>`;
write('public/configuracoes.html',cfg);

console.log('Navegação mobile principal reorganizada em 4 abas.');
