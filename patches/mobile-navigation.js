const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8');}
function write(p,s){fs.writeFileSync(p,s);}

let l=read('public/js/layout.js');

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
        { id:'dashboard', label:'Início', href:'dashboard.html', icon:'dashboard' },
        { id:'admin', label:'Clientes', href:'admin.html', icon:'clientes' },
        { id:'pedidos', label:'Pedidos', href:'pedidos.html', icon:'pedidos' },
        { id:'configuracoes', label:'Configurações', href:'configuracoes.html', icon:'plano' },
      ]
    : [
        { id:'dashboard', label:'Início', href:'dashboard.html', icon:'dashboard' },
        { id:'produtos', label:'Produtos', href:'produtos.html', icon:'produtos' },
        { id:'pedidos', label:'Pedidos', href:'pedidos.html', icon:'pedidos' },
        { id:'configuracoes', label:'Configurações', href:'configuracoes.html', icon:'plano' },
      ];

  const ativo = (paginaAtiva === 'admin-cliente' || paginaAtiva === 'onboarding') ? 'admin' : paginaAtiva;
  return '<nav class="tabbar tabbar-principal">' + itens.map((item) => \`
    <a href="\${item.href}" class="\${item.id === ativo ? 'active' : ''}">
      \${ICONES[item.icon] || ICONES.onboarding}
      <span>\${item.label}</span>
    </a>\`).join('') + '</nav>';
}`;

if(l.includes(oldTab)) {
  l=l.replace(oldTab,newTab);
} else if(!l.includes("tabbar-principal")) {
  throw new Error('montarTabbar original não encontrado');
}
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
