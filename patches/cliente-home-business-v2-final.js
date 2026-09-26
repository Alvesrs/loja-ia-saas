const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

/* 1) Garante precedência da rota cliente-hub antes das rotas genéricas /api/lojas */
let app=read('src/app.js');
if(!app.includes("const clienteHubRoutes = require('./routes/clienteHub.routes');")){
  const firstUse=app.indexOf('app.use(');
  if(firstUse<0)throw new Error('Nenhum app.use encontrado em src/app.js');
  app=app.slice(0,firstUse)+"const clienteHubRoutes = require('./routes/clienteHub.routes');\n"+app.slice(firstUse);
}
app=app.replace(/\n?app\.use\((['"])\/api\/lojas\/:lojaId\/cliente-hub\1\s*,\s*clienteHubRoutes\);\n?/g,'\n');

const genericCandidates=[
  "app.use('/api/lojas/:lojaId",
  'app.use("/api/lojas/:lojaId',
  "app.use('/api/lojas'",
  'app.use("/api/lojas"'
];
let routePos=-1;
for(const a of genericCandidates){
  const i=app.indexOf(a);
  if(i>=0&&(routePos<0||i<routePos))routePos=i;
}
if(routePos<0){
  routePos=app.indexOf("app.use('/api/auth'");
  if(routePos<0)routePos=app.indexOf('module.exports');
}
if(routePos<0)throw new Error('Ponto de inserção das rotas não encontrado');
const mount="app.use('/api/lojas/:lojaId/cliente-hub', clienteHubRoutes);\n";
app=app.slice(0,routePos)+mount+app.slice(routePos);

/* 2) Evita HTML antigo preso em cache na Central */
app=app.replace(
  /app\.get\('\/cliente\/cliente-central\.html',[^;]+;?\n?/,
  "app.get('/cliente/cliente-central.html', (_req, res) => { res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate'); res.set('Pragma','no-cache'); res.set('Expires','0'); return res.sendFile(__saintsaiClientPath.join(__saintsaiClientDir, 'cliente-central.html')); });\n"
);
write('src/app.js',app);

/* 3) Garante que a Home nova exista de verdade no HTML final */
let h=read('public/cliente-central.html');

if(!h.includes('SAINTSAI_HOME_BUSINESS_V2_FINAL')){
  h=h.replace('</style>',`
/* SAINTSAI_HOME_BUSINESS_V2_FINAL */
.top-actions{display:flex;align-items:center;gap:8px}
.notify-btn{position:relative;width:43px;height:43px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.045);color:#fff;font-size:18px;display:grid;place-items:center}
.notify-count{position:absolute;right:-4px;top:-5px;min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:#9a4eff;color:#fff;border:2px solid #08070d;font-size:10px;font-weight:1000;display:grid;place-items:center}
.notify-count.zero{display:none}
.setup-wrap.hidden-setup{display:none!important}
.business-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:14px}
.business-kpi{border:1px solid rgba(255,255,255,.07);border-radius:18px;padding:14px;background:linear-gradient(180deg,rgba(22,18,31,.96),rgba(13,11,19,.98))}
.business-kpi-label{font-size:11px;color:#9991a6;font-weight:800}
.business-kpi-value{font-size:23px;font-weight:950;margin-top:8px;letter-spacing:-.04em}
.business-kpi-foot{font-size:10px;color:#706979;margin-top:5px}
.today-box{margin-top:12px}
.today-head{display:flex;align-items:end;justify-content:space-between;gap:10px;margin-bottom:10px}
.today-head h2{margin:0}
.today-count{font-size:11px;color:#9b93a8}
.today-client{display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:11px;align-items:center;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.06)}
.today-client:last-child{border-bottom:0}
.today-time{font-size:14px;font-weight:950;color:#c8a7ff}
.today-name{font-size:14px;font-weight:900}
.today-service{font-size:11px;color:#8f879d;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.today-money{font-size:14px;font-weight:950;color:#65d9a8;white-space:nowrap}
.setup-note{margin-bottom:12px;border:1px solid rgba(158,101,255,.20);border-radius:18px;padding:13px;background:rgba(110,55,195,.08);display:flex;gap:10px;align-items:center}
.setup-note strong{font-size:13px}.setup-note small{display:block;color:#90889d;margin-top:3px}
@media(max-width:560px){.business-kpis{grid-template-columns:1fr 1fr}.business-kpi:last-child{grid-column:1/-1}.today-client{grid-template-columns:52px minmax(0,1fr) auto}}
</style>`);

  if(!h.includes('id="notify-config"')){
    const sair='<button class="btn2" onclick="fazerLogout()">Sair</button>';
    if(!h.includes(sair))throw new Error('Botão Sair não encontrado para inserir notificações');
    h=h.replace(sair,'<div class="top-actions"><button id="notify-config" class="notify-btn" type="button" aria-label="Pendências de configuração">🔔<span id="notify-count" class="notify-count zero">0</span></button>'+sair+'</div>');
  }

  if(!h.includes('id="business-home"')){
    const onboarding='<div id="onboarding-real"></div>';
    if(!h.includes(onboarding))throw new Error('Container onboarding não encontrado');
    h=h.replace(onboarding,
      '<div id="setup-zone" class="setup-wrap"><div class="setup-note"><span style="font-size:20px">✦</span><div><strong>Finalize a configuração do SaintsAI</strong><small>As pendências também ficam no sino do cabeçalho.</small></div></div>'+onboarding+'</div>'+
      '<div id="business-home"><div class="business-kpis">'+
      '<div class="business-kpi"><div class="business-kpi-label">Hoje</div><div class="business-kpi-value" id="biz-hoje">R$ 0,00</div><div class="business-kpi-foot" id="biz-hoje-foot">Recebido hoje</div></div>'+
      '<div class="business-kpi"><div class="business-kpi-label">Este mês</div><div class="business-kpi-value" id="biz-mes">R$ 0,00</div><div class="business-kpi-foot">Total previsto no mês</div></div>'+
      '<div class="business-kpi"><div class="business-kpi-label">Fechamento</div><div class="business-kpi-value" id="biz-fechamento">R$ 0,00</div><div class="business-kpi-foot" id="biz-fechamento-foot">Recebido no mês</div></div>'+
      '</div><div class="panel today-box"><div class="today-head"><div><div class="section-kicker">Agenda de hoje</div><h2>Clientes do dia</h2></div><div id="today-count" class="today-count">0 clientes</div></div><div id="clientes-dia"><div class="empty-state">Carregando clientes de hoje…</div></div></div></div>'
    );
  }

  if(!h.includes('id="sv-desc"')){
    const dur='<div class="row"><div class="field"><label>Duração (min)</label>';
    if(!h.includes(dur))throw new Error('Campos de serviço não encontrados');
    h=h.replace(dur,'<div class="field"><label>Descrição para a IA / WhatsApp</label><input id="sv-desc" placeholder="Ex.: opções, acabamento, detalhes importantes"></div>'+dur);
  }

  if(!h.includes("descricao:$('sv-desc').value")){
    h=h.replace(
      "JSON.stringify({nome:$('sv-nome').value,preco:$('sv-preco').value",
      "JSON.stringify({nome:$('sv-nome').value,descricao:$('sv-desc').value,preco:$('sv-preco').value"
    );
  }

  if(!h.includes('function carregarHomeNegocio()')){
    const money="function dinheiro(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}";
    if(!h.includes(money))throw new Error('Função dinheiro não encontrada');
    h=h.replace(money,money+`
function horaBR(iso){return new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
async function carregarHomeNegocio(){
  if(!loja)return;
  try{
    const x=await apiFetch('/lojas/'+loja.id+'/cliente-hub/inicio');
    $('biz-hoje').textContent=dinheiro(x.hoje?.total||0);
    $('biz-hoje-foot').textContent=(x.hoje?.quantidade||0)+' atendimento'+((x.hoje?.quantidade||0)===1?'':'s')+' hoje';
    $('biz-mes').textContent=dinheiro(x.mes?.previsto||0);
    $('biz-fechamento').textContent=dinheiro(x.fechamento?.recebido||0);
    $('biz-fechamento-foot').textContent=Number(x.fechamento?.pendente||0)>0?'Pendente: '+dinheiro(x.fechamento.pendente):'Tudo recebido no mês';
    const cs=x.hoje?.clientes||[];
    $('today-count').textContent=cs.length+' cliente'+(cs.length===1?'':'s');
    $('clientes-dia').innerHTML=cs.length?cs.map(a=>'<div class="today-client"><div class="today-time">'+horaBR(a.inicio)+'</div><div><div class="today-name">'+esc(a.nome)+'</div><div class="today-service">'+esc(a.servico)+'</div></div><div class="today-money">+'+dinheiro(a.valor)+'</div></div>').join(''):'<div class="empty-state">Nenhum cliente marcado para hoje.</div>';
  }catch(e){
    const el=$('clientes-dia');if(el)el.innerHTML='<div class="empty-state">Não foi possível carregar o resumo agora.</div>';
  }
}`);
  }

  if(!h.includes("badge.classList.toggle('zero',faltam===0)")){
    h=h.replace(
      "const next=o.proxima;",
      "const next=o.proxima;const faltam=(o.etapas||[]).filter(e=>!e.concluida).length;const badge=$('notify-count');if(badge){badge.textContent=String(faltam);badge.classList.toggle('zero',faltam===0);}const zone=$('setup-zone');if(zone)zone.classList.toggle('hidden-setup',!!o.pronto);"
    );
  }

  if(!h.includes("const nb=$('notify-config')")){
    const clickAnchor="document.querySelectorAll('[data-sec]').forEach(b=>b.addEventListener('click',()=>trocar(b.dataset.sec)));";
    if(!h.includes(clickAnchor))throw new Error('Handler de navegação não encontrado');
    h=h.replace(clickAnchor,clickAnchor+"const nb=$('notify-config');if(nb)nb.onclick=()=>{trocar('inicio');setTimeout(()=>{const z=$('setup-zone');if(z&&!z.classList.contains('hidden-setup'))z.scrollIntoView({behavior:'smooth',block:'start'});},50);};");
  }

  const callPattern=/renderServicos\(\);renderAgenda\(\);renderPag\(\);([^}]*)/;
  if(!h.includes('carregarHomeNegocio();')){
    h=h.replace('carregarOnboarding();','carregarOnboarding();carregarHomeNegocio();');
  }
}

write('public/cliente-central.html',h);

cp.execFileSync(process.execPath,['--check','src/app.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','src/controllers/clienteHub.controller.js'],{stdio:'inherit'});
console.log('Cliente Home v2 final aplicada com rota priorizada e cache desativado.');
