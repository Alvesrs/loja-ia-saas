const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

/* Backend: resumo específico da Home do portal cliente */
let c=read('src/controllers/clienteHub.controller.js');
if(!c.includes('async function inicioCliente')){
  const insert=`
async function inicioCliente(req,res){
  try{
    const loja=await exigirLoja(req,res);if(!loja)return;
    const agora=new Date();
    const inicioHoje=new Date(agora);inicioHoje.setHours(0,0,0,0);
    const fimHoje=new Date(agora);fimHoje.setHours(23,59,59,999);
    const inicioMes=new Date(agora.getFullYear(),agora.getMonth(),1,0,0,0,0);
    const fimMes=new Date(agora.getFullYear(),agora.getMonth()+1,0,23,59,59,999);

    const {data:mes,error}=await supabase.from('saintsai_agendamentos')
      .select('id,cliente_nome,inicio,valor,status,pagamento_status,saintsai_servicos(nome)')
      .eq('loja_id',loja.id)
      .gte('inicio',inicioMes.toISOString())
      .lte('inicio',fimMes.toISOString())
      .order('inicio',{ascending:true});
    if(error)throw error;

    const validos=(mes||[]).filter(x=>x.status!=='cancelado');
    const hoje=validos.filter(x=>{
      const d=new Date(x.inicio);
      return d>=inicioHoje&&d<=fimHoje;
    });
    const recebido=x=>x.pagamento_status==='pago'||x.pagamento_status==='presencial';
    const soma=arr=>arr.reduce((a,x)=>a+Number(x.valor||0),0);

    return res.json({
      hoje:{
        clientes:hoje.map(x=>({
          id:x.id,
          nome:x.cliente_nome||'Cliente',
          inicio:x.inicio,
          servico:x.saintsai_servicos?.nome||'Serviço',
          valor:Number(x.valor||0),
          pagamento_status:x.pagamento_status,
          status:x.status
        })),
        total:soma(hoje.filter(recebido)),
        previstos:soma(hoje),
        quantidade:hoje.length
      },
      mes:{
        previsto:soma(validos),
        recebido:soma(validos.filter(recebido)),
        quantidade:validos.length
      },
      fechamento:{
        recebido:soma(validos.filter(recebido)),
        pendente:soma(validos.filter(x=>!recebido(x))),
        total:soma(validos)
      }
    });
  }catch(e){
    console.error('[cliente-hub] inicio',e?.message||e);
    return res.status(500).json({erro:'Não foi possível carregar o resumo inicial.'});
  }
}
`;
  const exp=c.lastIndexOf('module.exports=');
  if(exp<0)throw new Error('Export clienteHub não encontrado');
  c=c.slice(0,exp)+insert+'\n'+c.slice(exp);
  c=c.replace(/module\.exports=\{([^}]*)\}/,(m,inside)=>{
    if(inside.includes('inicioCliente'))return m;
    return 'module.exports={'+inside.trim().replace(/,$/,'')+',inicioCliente}';
  });
}
write('src/controllers/clienteHub.controller.js',c);

let r=read('src/routes/clienteHub.routes.js');
if(!r.includes("'/inicio'")){
  const anchor="r.get('/onboarding',c.onboardingCliente);";
  if(!r.includes(anchor))throw new Error('Rota onboarding não encontrada');
  r=r.replace(anchor,anchor+"\nr.get('/inicio',c.inicioCliente);");
}
write('src/routes/clienteHub.routes.js',r);

let h=read('public/cliente-central.html');
if(!h.includes('SAINTSAI_HOME_BUSINESS_V1')){
  h=h.replace('</style>',`
/* SAINTSAI_HOME_BUSINESS_V1 */
.top-actions{display:flex;align-items:center;gap:8px}
.notify-btn{
  position:relative;width:43px;height:43px;border-radius:14px;border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.045);color:#fff;font-size:19px;display:grid;place-items:center
}
.notify-count{
  position:absolute;right:-4px;top:-5px;min-width:19px;height:19px;padding:0 5px;border-radius:999px;
  background:#9a4eff;color:#fff;border:2px solid #08070d;font-size:10px;font-weight:1000;display:grid;place-items:center
}
.notify-count.zero{display:none}
.setup-wrap.hidden-setup{display:none}
.business-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:14px}
.business-kpi{
  border:1px solid rgba(255,255,255,.07);border-radius:18px;padding:14px;
  background:linear-gradient(180deg,rgba(22,18,31,.96),rgba(13,11,19,.98))
}
.business-kpi-label{font-size:11px;color:#9991a6;font-weight:800}
.business-kpi-value{font-size:23px;font-weight:950;margin-top:8px;letter-spacing:-.04em}
.business-kpi-foot{font-size:10px;color:#706979;margin-top:5px}
.today-box{margin-top:12px}
.today-head{display:flex;align-items:end;justify-content:space-between;gap:10px;margin-bottom:10px}
.today-head h2{margin:0}
.today-count{font-size:11px;color:#9b93a8}
.today-client{
  display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:11px;align-items:center;
  padding:13px 0;border-bottom:1px solid rgba(255,255,255,.06)
}
.today-client:last-child{border-bottom:0}
.today-time{font-size:14px;font-weight:950;color:#c8a7ff}
.today-name{font-size:14px;font-weight:900}
.today-service{font-size:11px;color:#8f879d;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.today-money{font-size:14px;font-weight:950;color:#65d9a8;white-space:nowrap}
.setup-note{
  margin-bottom:12px;border:1px solid rgba(158,101,255,.20);border-radius:18px;padding:13px;
  background:rgba(110,55,195,.08);display:flex;gap:10px;align-items:center
}
.setup-note strong{font-size:13px}.setup-note small{display:block;color:#90889d;margin-top:3px}
.catalog-hint{margin-top:9px;padding:10px 12px;border-radius:13px;background:rgba(133,76,245,.08);color:#b7aec5;font-size:11px;line-height:1.45}
@media(max-width:560px){
  .business-kpis{grid-template-columns:1fr 1fr}
  .business-kpi:last-child{grid-column:1/-1}
  .today-client{grid-template-columns:52px minmax(0,1fr) auto}
}
</style>`);

  /* cabeçalho com sino */
  h=h.replace(
    '<button class="btn2" onclick="fazerLogout()">Sair</button></div>',
    '<div class="top-actions"><button id="notify-config" class="notify-btn" type="button" aria-label="Pendências de configuração">♢<span id="notify-count" class="notify-count zero">0</span></button><button class="btn2" onclick="fazerLogout()">Sair</button></div></div>'
  );

  /* Home: mantém onboarding e adiciona operação */
  h=h.replace(
    '<section id="inicio" class="section active"><div id="onboarding-real"></div>',
    '<section id="inicio" class="section active"><div id="setup-zone" class="setup-wrap"><div class="setup-note"><span style="font-size:20px">✦</span><div><strong>Finalize a configuração do SaintsAI</strong><small>Essas pendências também aparecem no sino do cabeçalho.</small></div></div><div id="onboarding-real"></div></div><div id="business-home"><div class="business-kpis"><div class="business-kpi"><div class="business-kpi-label">Hoje</div><div class="business-kpi-value" id="biz-hoje">R$ 0,00</div><div class="business-kpi-foot" id="biz-hoje-foot">Recebido hoje</div></div><div class="business-kpi"><div class="business-kpi-label">Este mês</div><div class="business-kpi-value" id="biz-mes">R$ 0,00</div><div class="business-kpi-foot">Total previsto no mês</div></div><div class="business-kpi"><div class="business-kpi-label">Fechamento</div><div class="business-kpi-value" id="biz-fechamento">R$ 0,00</div><div class="business-kpi-foot" id="biz-fechamento-foot">Recebido no mês</div></div></div><div class="panel today-box"><div class="today-head"><div><div class="section-kicker">Agenda de hoje</div><h2>Clientes do dia</h2></div><div id="today-count" class="today-count">0 clientes</div></div><div id="clientes-dia"></div></div></div>'
  );

  /* catálogo mais genérico + descrição */
  h=h.replace('<h2>Serviços</h2>','<h2>Itens e serviços</h2><p class="muted">Cadastre qualquer coisa que sua empresa oferece. Ex.: corte degradê, corte navalhado, unha em gel, manicure, consulta, instalação ou produto.</p>');
  h=h.replace(
    '<div class="row"><div class="field"><label>Nome</label><input id="sv-nome" placeholder="Ex.: Consulta"></div><div class="field"><label>Preço</label>',
    '<div class="row"><div class="field"><label>Nome</label><input id="sv-nome" placeholder="Ex.: Unha em gel"></div><div class="field"><label>Preço</label>'
  );
  h=h.replace(
    '<div class="row"><div class="field"><label>Duração (min)</label>',
    '<div class="field"><label>Descrição para a IA / WhatsApp</label><input id="sv-desc" placeholder="Ex.: acabamento, opções, detalhes importantes"></div><div class="catalog-hint">A IA usa esse catálogo no atendimento e pode apresentar as opções ao cliente pelo WhatsApp.</div><div class="row"><div class="field"><label>Duração (min)</label>'
  );

  /* novo serviço envia descrição */
  h=h.replace(
    "body:JSON.stringify({nome:$('sv-nome').value,preco:$('sv-preco').value,duracao_min:Number($('sv-dur').value),intervalo_pos_min:Number($('sv-int').value)})",
    "body:JSON.stringify({nome:$('sv-nome').value,descricao:$('sv-desc').value,preco:$('sv-preco').value,duracao_min:Number($('sv-dur').value),intervalo_pos_min:Number($('sv-int').value)})"
  );

  /* funções da home */
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
    $('biz-fechamento-foot').textContent=(Number(x.fechamento?.pendente||0)>0?'Pendente: '+dinheiro(x.fechamento.pendente):'Tudo recebido no mês');
    const cs=x.hoje?.clientes||[];
    $('today-count').textContent=cs.length+' cliente'+(cs.length===1?'':'s');
    $('clientes-dia').innerHTML=cs.length?cs.map(a=>'<div class="today-client"><div class="today-time">'+horaBR(a.inicio)+'</div><div><div class="today-name">'+esc(a.nome)+'</div><div class="today-service">'+esc(a.servico)+'</div></div><div class="today-money">+'+dinheiro(a.valor)+'</div></div>').join(''):'<div class="empty-state">Nenhum cliente marcado para hoje.</div>';
  }catch(_){}
}`);

  /* onboarding: ocultar ao concluir e alimentar sino */
  h=h.replace(
    "const next=o.proxima;",
    "const next=o.proxima;const faltam=(o.etapas||[]).filter(e=>!e.concluida).length;const badge=$('notify-count');if(badge){badge.textContent=String(faltam);badge.classList.toggle('zero',faltam===0);}const zone=$('setup-zone');if(zone)zone.classList.toggle('hidden-setup',!!o.pronto);"
  );

  /* carregar home junto */
  h=h.replace(
    "renderServicos();renderAgenda();renderPag();carregarOnboarding();",
    "renderServicos();renderAgenda();renderPag();carregarOnboarding();carregarHomeNegocio();"
  );

  /* sino leva para checklist */
  h=h.replace(
    "document.querySelectorAll('[data-sec]').forEach(b=>b.addEventListener('click',()=>trocar(b.dataset.sec)));",
    "document.querySelectorAll('[data-sec]').forEach(b=>b.addEventListener('click',()=>trocar(b.dataset.sec)));const nb=$('notify-config');if(nb)nb.onclick=()=>{trocar('inicio');setTimeout(()=>{const z=$('setup-zone');if(z&&!z.classList.contains('hidden-setup'))z.scrollIntoView({behavior:'smooth',block:'start'});},60);};"
  );
}
write('public/cliente-central.html',h);

cp.execFileSync(process.execPath,['--check','src/controllers/clienteHub.controller.js'],{stdio:'inherit'});
console.log('Home operacional do portal cliente aplicada.');
