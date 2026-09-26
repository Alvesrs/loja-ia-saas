const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

/* Endpoint isolado de onboarding do PORTAL CLIENTE */
let c=read('src/controllers/clienteHub.controller.js');
if(!c.includes('async function onboardingCliente')){
  const insert=`
async function onboardingCliente(req,res){
  try{
    const lojaId=String(req.params.lojaId||'');
    const usuarioId=req.usuario.id;
    const {data:loja,error:el}=await supabase.from('lojas')
      .select('id,nome,prompt_mestre').eq('id',lojaId).eq('dono_id',usuarioId).maybeSingle();
    if(el)throw el;
    if(!loja)return res.status(404).json({erro:'Loja não encontrada.'});

    const [{data:servicos,error:e1},{data:agendaCfg,error:e2},{data:pag,error:e3},{data:wa,error:e4}]=await Promise.all([
      supabase.from('saintsai_servicos').select('id',{count:'exact'}).eq('loja_id',lojaId).eq('ativo',true).limit(1),
      supabase.from('saintsai_agenda_config').select('horarios').eq('loja_id',lojaId).maybeSingle(),
      supabase.from('saintsai_pagamento_config').select('conectado,aceita_pix_online,aceita_pix_presencial,aceita_dinheiro,aceita_cartao_presencial').eq('loja_id',lojaId).maybeSingle(),
      supabase.from('whatsapp_configuracoes').select('id,ativo').eq('loja_id',lojaId).eq('ativo',true).limit(1)
    ]);
    if(e1||e2||e3||e4)throw (e1||e2||e3||e4);

    const prompt=String(loja.prompt_mestre||'')
      .replace(/\[SAINTSAI_CONFIG_CLIENTE\][\s\S]*?\[\/SAINTSAI_CONFIG_CLIENTE\]/g,'')
      .trim();
    const horarios=agendaCfg?.horarios||{};
    const agendaOk=Object.values(horarios).some(x=>x&&x.aberto===true&&x.inicio&&x.fim);
    const pagOk=Boolean(pag&&(pag.aceita_pix_online||pag.aceita_pix_presencial||pag.aceita_dinheiro||pag.aceita_cartao_presencial||pag.conectado));

    const etapas=[
      {id:'ia',titulo:'Configure a IA',descricao:'Conte o que sua empresa faz, o que vende e como a IA deve atender.',concluida:prompt.length>=40,destino:'ia'},
      {id:'servicos',titulo:'Cadastre seus serviços',descricao:'Adicione pelo menos um serviço com preço, duração e detalhes.',concluida:Boolean(servicos&&servicos.length),destino:'servicos'},
      {id:'agenda',titulo:'Defina sua agenda',descricao:'Escolha dias, horários e intervalos de atendimento.',concluida:agendaOk,destino:'agenda'},
      {id:'pagamentos',titulo:'Configure pagamentos',descricao:'Defina quando e como o cliente pode pagar.',concluida:pagOk,destino:'pagamentos'},
      {id:'operacao',titulo:'Conecte e teste o atendimento',descricao:'Deixe o WhatsApp ativo e faça um teste antes de divulgar.',concluida:Boolean(wa&&wa.length),destino:'operacao'}
    ];
    const concluidas=etapas.filter(x=>x.concluida).length;
    const percentual=Math.round((concluidas/etapas.length)*100);
    const proxima=etapas.find(x=>!x.concluida)||null;
    return res.json({percentual,concluidas,total:etapas.length,etapas,proxima:proxima?.id||null,pronto:percentual===100});
  }catch(e){
    console.error('[cliente-hub] onboarding',e?.message||e);
    return res.status(500).json({erro:'Não foi possível carregar o progresso da configuração.'});
  }
}
`;
  const exp=c.lastIndexOf('module.exports=');
  if(exp<0)throw new Error('Export do clienteHub não encontrado');
  c=c.slice(0,exp)+insert+'\n'+c.slice(exp);
  c=c.replace(/module\.exports=\{([^}]*)\}/, (m,inside)=>{
    if(inside.includes('onboardingCliente'))return m;
    return 'module.exports={'+inside.trim().replace(/,$/,'')+',onboardingCliente}';
  });
}
write('src/controllers/clienteHub.controller.js',c);

let r=read('src/routes/clienteHub.routes.js');
if(!r.includes("'/onboarding'")){
  const anchor="r.get('/',c.resumo);";
  if(!r.includes(anchor))throw new Error('Anchor resumo clienteHub não encontrado');
  r=r.replace(anchor,anchor+"\nr.get('/onboarding',c.onboardingCliente);");
}
write('src/routes/clienteHub.routes.js',r);

/* UI real do portal cliente */
let h=read('public/cliente-central.html');
if(!h.includes('SAINTSAI_ONBOARDING_V1')){
  h=h.replace('</style>', `
/* SAINTSAI_ONBOARDING_V1 */
.onboard{
  margin:0 0 16px;border-radius:22px;padding:18px;
  border:1px solid rgba(158,101,255,.25);
  background:
    radial-gradient(circle at 95% 0%,rgba(144,73,255,.22),transparent 28%),
    linear-gradient(145deg,rgba(34,20,56,.96),rgba(15,12,22,.98));
  box-shadow:0 14px 42px rgba(0,0,0,.22)
}
.onboard-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
.onboard-kicker{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#b78aff;font-weight:900}
.onboard-title{font-size:20px;font-weight:950;line-height:1.12;margin-top:5px}
.onboard-sub{font-size:12px;color:#aaa2b7;line-height:1.45;margin-top:5px}
.onboard-pct{font-size:25px;font-weight:1000;color:#d7baff;letter-spacing:-.05em;white-space:nowrap}
.onboard-track{height:9px;border-radius:999px;background:rgba(255,255,255,.065);overflow:hidden;margin:14px 0 13px}
.onboard-bar{height:100%;border-radius:999px;background:linear-gradient(90deg,#7137ee,#9b4fff,#bf7aff);box-shadow:0 0 18px rgba(164,82,255,.34);transition:width .3s ease}
.onboard-steps{display:grid;gap:8px}
.onboard-step{
  display:grid;grid-template-columns:31px 1fr auto;gap:11px;align-items:center;
  padding:11px 12px;border:1px solid rgba(255,255,255,.065);border-radius:15px;
  background:rgba(255,255,255,.025);cursor:pointer
}
.onboard-step.next{border-color:rgba(158,101,255,.36);background:rgba(123,64,229,.10)}
.onboard-step.done{opacity:.82}
.onboard-num{
  width:31px;height:31px;border-radius:10px;display:grid;place-items:center;
  background:rgba(133,76,245,.14);color:#c8a6ff;font-size:12px;font-weight:950
}
.onboard-step.done .onboard-num{background:rgba(69,211,154,.12);color:#6ee7b7}
.onboard-step-title{font-size:13px;font-weight:900;color:#f5f1fb}
.onboard-step-desc{font-size:11px;color:#8f879d;line-height:1.35;margin-top:3px}
.onboard-status{font-size:10px;font-weight:900;border-radius:999px;padding:5px 7px;white-space:nowrap;background:rgba(255,255,255,.055);color:#a69fac}
.onboard-step.done .onboard-status{background:rgba(69,211,154,.10);color:#6ee7b7}
.onboard-step.next .onboard-status{background:rgba(139,92,246,.16);color:#ceb2ff}
.onboard-action{
  width:100%;margin-top:13px;min-height:46px;border:0;border-radius:14px;
  background:linear-gradient(135deg,#7137ee,#a24fff);color:#fff;font:inherit;font-weight:900;
  box-shadow:0 10px 25px rgba(124,58,237,.22)
}
.onboard.done-all{border-color:rgba(69,211,154,.22)}
.onboard.done-all .onboard-bar{background:linear-gradient(90deg,#28b87d,#65d9a8)}
@media(max-width:560px){
  .onboard{padding:15px;border-radius:19px}
  .onboard-title{font-size:18px}
  .onboard-step{grid-template-columns:29px 1fr;padding:10px}
  .onboard-status{grid-column:2/3;justify-self:start;margin-top:1px}
}
</style>`);

  const home='<section id="inicio" class="section active">';
  if(!h.includes(home))throw new Error('Seção início não encontrada');
  h=h.replace(home,home+'<div id="onboarding-real"></div>');

  const money="function dinheiro(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}";
  if(!h.includes(money))throw new Error('Função dinheiro não encontrada');
  h=h.replace(money,money+`
function onboardingDestino(destino){
  if(destino==='ia'){location.href='cliente-estoque.html?secao=agente';return;}
  if(destino==='operacao'){location.href='whatsapp.html';return;}
  trocar(destino);
  window.scrollTo({top:0,behavior:'smooth'});
}
async function carregarOnboarding(){
  const box=document.getElementById('onboarding-real');if(!box||!loja)return;
  try{
    const o=await apiFetch('/lojas/'+loja.id+'/cliente-hub/onboarding');
    const etapas=o.etapas||[];
    const next=o.proxima;
    box.innerHTML='<div class="onboard '+(o.pronto?'done-all':'')+'">'+
      '<div class="onboard-top"><div><div class="onboard-kicker">'+(o.pronto?'Tudo pronto':'Comece por aqui')+'</div>'+
      '<div class="onboard-title">'+(o.pronto?'Configuração concluída':'Prepare sua empresa para atender')+'</div>'+
      '<div class="onboard-sub">'+(o.pronto?'Seu SaintsAI já está configurado para operar.':'Siga as etapas abaixo. O progresso é atualizado automaticamente.')+'</div></div>'+
      '<div class="onboard-pct">'+Number(o.percentual||0)+'%</div></div>'+
      '<div class="onboard-track"><div class="onboard-bar" style="width:'+Number(o.percentual||0)+'%"></div></div>'+
      '<div class="onboard-steps">'+etapas.map((e,i)=>'<div class="onboard-step '+(e.concluida?'done ':'')+(e.id===next?'next':'')+'" data-onboard="'+e.destino+'">'+
        '<div class="onboard-num">'+(e.concluida?'✓':(i+1))+'</div><div><div class="onboard-step-title">'+e.titulo+'</div><div class="onboard-step-desc">'+e.descricao+'</div></div>'+
        '<div class="onboard-status">'+(e.concluida?'Concluído':(e.id===next?'Próximo':'Pendente'))+'</div></div>').join('')+'</div>'+
      (o.pronto?'<button class="onboard-action" data-onboard="agenda">Ir para a operação</button>':'<button class="onboard-action" data-onboard="'+(etapas.find(e=>e.id===next)?.destino||'inicio')+'">Continuar configuração</button>')+
      '</div>';
    box.querySelectorAll('[data-onboard]').forEach(el=>el.onclick=()=>onboardingDestino(el.dataset.onboard));
  }catch(_){box.innerHTML='';}
}`);

  const loadCall="renderServicos();renderAgenda();renderPag();";
  if(!h.includes(loadCall))throw new Error('Render principal não encontrado');
  h=h.replace(loadCall,loadCall+"carregarOnboarding();");
}
write('public/cliente-central.html',h);

cp.execFileSync(process.execPath,['--check','src/controllers/clienteHub.controller.js'],{stdio:'inherit'});
console.log('Onboarding real adicionado somente ao portal SaintsAI Cliente.');
