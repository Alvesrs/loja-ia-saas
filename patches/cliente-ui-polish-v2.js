const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}
const p='public/cliente-central.html';
let h=read(p);

if(!h.includes('SAINTSAI_CLIENT_UI_V2')){
  h=h.replace('</style>', `
/* SAINTSAI_CLIENT_UI_V2 */
:root{
  --bg:#07060b;--surface:#0f0d16;--surface2:#15111f;--surface3:#1b1428;
  --line:rgba(179,132,255,.16);--line2:rgba(255,255,255,.07);
  --text:#f7f4ff;--muted:#9f98ad;--purple:#8b5cf6;--purple2:#a855f7;
  --green:#45d39a;--amber:#f6c767;--red:#ff6b7a;
  --shadow:0 18px 50px rgba(0,0,0,.28);
}
html{background:var(--bg)}
body{
  min-height:100vh;background:
  radial-gradient(circle at 15% -10%,rgba(117,61,255,.20),transparent 34%),
  radial-gradient(circle at 100% 8%,rgba(162,79,255,.10),transparent 28%),
  var(--bg);color:var(--text);letter-spacing:-.01em
}
.app{max-width:980px;padding:calc(18px + env(safe-area-inset-top)) 16px calc(116px + env(safe-area-inset-bottom))}
.top{
  position:sticky;top:0;z-index:20;margin:0 -6px 18px;padding:10px 6px 12px;
  background:linear-gradient(180deg,rgba(7,6,11,.97),rgba(7,6,11,.82),transparent);
  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)
}
.brand{font-size:21px;letter-spacing:-.035em}
.brand:before{
  content:'S';display:inline-grid;place-items:center;width:34px;height:34px;margin-right:10px;
  border-radius:11px;background:linear-gradient(145deg,#5522b9,#9d4dff);
  box-shadow:0 8px 26px rgba(124,58,237,.36);font-size:19px;font-weight:1000;color:#fff;vertical-align:middle
}
.top .muted{margin-top:5px;font-size:13px}
.top .btn2{border-radius:999px;padding:10px 13px;background:rgba(255,255,255,.045);border-color:var(--line2);font-size:13px}

.client-hero{
  position:relative;overflow:hidden;border:1px solid rgba(146,92,255,.32);
  border-radius:24px;padding:20px;margin-bottom:14px;
  background:
    radial-gradient(circle at 92% 5%,rgba(153,72,255,.28),transparent 30%),
    linear-gradient(145deg,rgba(45,23,78,.88),rgba(17,13,27,.98) 58%);
  box-shadow:var(--shadow)
}
.client-hero:after{content:'';position:absolute;width:150px;height:150px;border-radius:50%;right:-70px;bottom:-90px;background:rgba(143,72,255,.18);filter:blur(5px)}
.hero-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#b995ff;font-weight:900}
.hero-title{font-size:25px;line-height:1.05;font-weight:950;margin-top:8px;max-width:520px}
.hero-sub{color:#b5aec2;font-size:14px;line-height:1.5;margin-top:8px;max-width:620px}
.hero-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.hero-action{
  position:relative;z-index:2;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);
  color:#fff;border-radius:999px;padding:9px 12px;font:inherit;font-size:12px;font-weight:800
}
.hero-action.primary{background:#fff;color:#17101f;border-color:#fff}
.hero-date{position:absolute;top:18px;right:18px;font-size:11px;color:#b8afc7}

.cards{grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 16px}
.card{
  position:relative;overflow:hidden;min-height:112px;padding:15px 14px;border-radius:18px;
  background:linear-gradient(180deg,rgba(23,19,32,.95),rgba(15,13,22,.98));
  border:1px solid var(--line2);box-shadow:0 8px 30px rgba(0,0,0,.13)
}
.card:before{content:'';position:absolute;left:0;top:0;width:2px;height:100%;background:linear-gradient(#9c58ff,transparent)}
.metric-label{display:flex;align-items:center;gap:8px;color:#a69fb3;font-size:12px;font-weight:700}
.metric-icon{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:rgba(129,77,255,.14);color:#bd91ff;font-size:15px}
.value{font-size:25px;line-height:1.1;margin-top:11px;letter-spacing:-.04em}
.metric-foot{margin-top:7px;color:#6f687a;font-size:11px}

.modules{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 18px}
.module{
  min-height:76px;border-radius:16px;padding:13px;background:rgba(18,15,27,.85);
  border:1px solid var(--line2);font-size:13px;transition:.18s ease
}
.module small{font-size:11px;line-height:1.25;margin-top:6px}
.module.active{background:linear-gradient(145deg,rgba(111,51,232,.85),rgba(62,29,122,.88));border-color:rgba(176,121,255,.32);box-shadow:0 8px 30px rgba(86,35,166,.20)}
.module:active,.btn:active,.btn2:active,.nav:active,.hero-action:active{transform:scale(.985)}

.section{margin-top:0;animation:saintsIn .18s ease}
@keyframes saintsIn{from{opacity:.5;transform:translateY(4px)}to{opacity:1;transform:none}}
.panel{
  border-radius:22px;padding:18px;background:linear-gradient(180deg,rgba(18,15,27,.96),rgba(12,10,18,.98));
  border:1px solid var(--line2);box-shadow:0 10px 34px rgba(0,0,0,.16)
}
.panel h2{font-size:18px;margin:0 0 5px;letter-spacing:-.025em}
.panel h2+ .muted,.panel h2+p{font-size:13px}

.field{gap:7px;margin-top:14px}
.field label{font-size:12px;color:#bbb4c7;font-weight:800}
.field input,.field select{
  min-height:48px;border-radius:14px;padding:0 13px;background:#0b0910;border:1px solid rgba(255,255,255,.09);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.025)
}
.field input:focus,.field select:focus{outline:none;border-color:#8555dd;box-shadow:0 0 0 3px rgba(124,58,237,.12)}
.btn,.btn2{min-height:46px;border-radius:14px;padding:11px 15px}
.btn{background:linear-gradient(135deg,#7137ee,#9b4fff);box-shadow:0 10px 24px rgba(124,58,237,.22)}
.btn2{border-color:rgba(255,255,255,.09);background:#17131f}
.item{
  margin-top:9px;padding:13px 14px;border:1px solid rgba(255,255,255,.065)!important;
  border-radius:15px;background:rgba(255,255,255,.025)
}
.item strong{font-size:14px}.item .muted{margin-top:5px;font-size:12px;line-height:1.45}
.badge{padding:5px 8px;background:rgba(127,72,234,.14);border:1px solid rgba(158,105,255,.15);font-weight:800}
.notice{border-radius:15px;background:rgba(104,49,181,.11);border-color:rgba(164,103,255,.20);font-size:12px;line-height:1.45}
.switches{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}
.switches label{margin:0;padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(255,255,255,.025);font-size:12px}
.switches input{accent-color:#8b5cf6}

.bottom{
  background:rgba(10,8,15,.90);border-top:1px solid rgba(255,255,255,.07);
  backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
  padding:8px max(12px,env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom))
}
.bottom-inner{
  max-width:640px;padding:5px;border:1px solid rgba(255,255,255,.06);border-radius:20px;
  background:rgba(17,14,24,.92);box-shadow:0 14px 40px rgba(0,0,0,.34)
}
.nav{
  min-height:52px;border-radius:15px;color:#817a8f;font-weight:800;font-size:10px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px
}
.nav .nav-ico{font-size:18px;line-height:1}
.nav.on{color:#c99bff;background:linear-gradient(180deg,rgba(113,55,238,.20),rgba(113,55,238,.06))}
.empty-state{padding:22px 12px;text-align:center;color:#756e80;font-size:13px}
.section-kicker{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#8e70bc;margin-bottom:6px}

@media(max-width:680px){
  .app{padding-left:13px;padding-right:13px}
  .cards{grid-template-columns:1fr 1fr}
  .cards .card:first-child{grid-column:1/-1}
  .modules{display:none}
  .client-hero{padding:18px 16px;border-radius:21px}
  .hero-title{font-size:23px;padding-right:28px}
  .hero-date{display:none}
  .panel{padding:16px}
  .switches{grid-template-columns:1fr}
  .top{margin-bottom:12px}
}
@media(min-width:681px){.bottom{display:none}.app{padding-bottom:32px}}
</style>`);

  h=h.replace(
    '<div class="top"><div><div class="brand">SaintsAI Cliente</div><div id="loja-nome" class="muted">Carregando sua empresa…</div></div><button class="btn2" onclick="fazerLogout()">Sair</button></div>',
    '<div class="top"><div><div class="brand">SaintsAI Cliente</div><div id="loja-nome" class="muted">Carregando sua empresa…</div></div><button class="btn2" onclick="fazerLogout()">Sair</button></div><div class="client-hero"><div class="hero-date" id="hero-date"></div><div class="hero-eyebrow">Central inteligente</div><div class="hero-title">Seu negócio em um só lugar.</div><div class="hero-sub">Acompanhe agenda, serviços, recebimentos e automações sem sair do SaintsAI.</div><div class="hero-actions"><button class="hero-action primary" data-sec="agenda">+ Novo agendamento</button><button class="hero-action" data-sec="servicos">Gerenciar serviços</button><button class="hero-action" data-sec="pagamentos">Ver pagamentos</button></div></div>'
  );

  h=h.replace(
    '<div class="cards"><div class="card"><div class="muted">Agendamentos hoje</div><div class="value" id="m-ag">0</div></div><div class="card"><div class="muted">Recebimentos</div><div class="value" id="m-rec">R$ 0</div></div><div class="card"><div class="muted">Pendentes</div><div class="value" id="m-pen">0</div></div></div>',
    '<div class="cards"><div class="card"><div class="metric-label"><span class="metric-icon">◫</span>Agendamentos hoje</div><div class="value" id="m-ag">0</div><div class="metric-foot">Agenda do dia</div></div><div class="card"><div class="metric-label"><span class="metric-icon">R$</span>Recebimentos</div><div class="value" id="m-rec">R$ 0</div><div class="metric-foot">Recebido hoje</div></div><div class="card"><div class="metric-label"><span class="metric-icon">○</span>Pendentes</div><div class="value" id="m-pen">0</div><div class="metric-foot">Precisam de atenção</div></div></div>'
  );

  h=h.replace(
    '<section id="inicio" class="section active"><div class="panel"><h2>Próximos agendamentos</h2>',
    '<section id="inicio" class="section active"><div class="panel"><div class="section-kicker">Hoje e próximos dias</div><h2>Próximos agendamentos</h2>'
  );
  h=h.replace(
    '<section id="agenda" class="section">',
    '<section id="agenda" class="section"><div class="section-kicker">Agenda inteligente</div>'
  );
  h=h.replace(
    '<section id="servicos" class="section">',
    '<section id="servicos" class="section"><div class="section-kicker">Catálogo de atendimento</div>'
  );
  h=h.replace(
    '<section id="pagamentos" class="section">',
    '<section id="pagamentos" class="section"><div class="section-kicker">Financeiro</div>'
  );

  h=h.replace(
    '<div class="bottom"><div class="bottom-inner"><button class="nav on" data-sec="inicio">Início</button><button class="nav" data-sec="agenda">Agenda</button><button class="nav" data-sec="servicos">Serviços</button><button class="nav" data-sec="pagamentos">Pagamentos</button><button class="nav" onclick="location.href=\'cliente-estoque.html?secao=agente\'">IA</button></div></div>',
    '<div class="bottom"><div class="bottom-inner"><button class="nav on" data-sec="inicio"><span class="nav-ico">⌂</span>Início</button><button class="nav" data-sec="agenda"><span class="nav-ico">▣</span>Agenda</button><button class="nav" data-sec="servicos"><span class="nav-ico">◇</span>Serviços</button><button class="nav" data-sec="pagamentos"><span class="nav-ico">▤</span>Pagamentos</button><button class="nav" onclick="location.href=\'cliente-estoque.html?secao=agente\'"><span class="nav-ico">✦</span>IA</button></div></div>'
  );

  h=h.replace(
    "function dinheiro(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}",
    "function dinheiro(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}\nfunction saintsUi(){const d=document.getElementById('hero-date');if(d)d.textContent=new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'short'}).format(new Date()).replace('.','');document.querySelectorAll('.hero-action[data-sec]').forEach(b=>b.onclick=()=>trocar(b.dataset.sec));}"
  );

  h=h.replace('carregar();\n</script>', 'saintsUi();\ncarregar();\n</script>');
}

write(p,h);
console.log('SaintsAI Cliente UI v2 aplicada sem alterar o painel admin.');
