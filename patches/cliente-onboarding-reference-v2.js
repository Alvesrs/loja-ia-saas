const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

let c=read('src/controllers/clienteHub.controller.js');

/* Ordem e textos alinhados ao onboarding real do negócio */
const oldSteps=`    const etapas=[
      {id:'ia',titulo:'Configure a IA',descricao:'Conte o que sua empresa faz, o que vende e como a IA deve atender.',concluida:prompt.length>=40,destino:'ia'},
      {id:'servicos',titulo:'Cadastre seus serviços',descricao:'Adicione pelo menos um serviço com preço, duração e detalhes.',concluida:Boolean(servicos&&servicos.length),destino:'servicos'},
      {id:'agenda',titulo:'Defina sua agenda',descricao:'Escolha dias, horários e intervalos de atendimento.',concluida:agendaOk,destino:'agenda'},
      {id:'pagamentos',titulo:'Configure pagamentos',descricao:'Defina quando e como o cliente pode pagar.',concluida:pagOk,destino:'pagamentos'},
      {id:'operacao',titulo:'Conecte e teste o atendimento',descricao:'Deixe o WhatsApp ativo e faça um teste antes de divulgar.',concluida:Boolean(wa&&wa.length),destino:'operacao'}
    ];`;

const newSteps=`    const etapas=[
      {id:'ia',titulo:'Configure a IA',descricao:'Defina sobre o que é sua empresa, o que vende e como a IA deve atender.',concluida:prompt.length>=40,destino:'ia'},
      {id:'servicos',titulo:'Cadastre itens e serviços',descricao:'Adicione opções com o nome, preço e detalhes que você quiser.',concluida:Boolean(servicos&&servicos.length),destino:'servicos'},
      {id:'pagamentos',titulo:'Configure pagamentos',descricao:'Defina quando e como o cliente pode pagar, inclusive pelo PagBank.',concluida:pagOk,destino:'pagamentos'},
      {id:'agenda',titulo:'Configure a agenda',descricao:'Escolha os dias, horários e intervalos de atendimento.',concluida:agendaOk,destino:'agenda'},
      {id:'operacao',titulo:'Conecte e teste o WhatsApp',descricao:'Ative o atendimento e faça um teste antes de divulgar.',concluida:Boolean(wa&&wa.length),destino:'operacao'}
    ];`;
if(c.includes(oldSteps)) c=c.replace(oldSteps,newSteps);
write('src/controllers/clienteHub.controller.js',c);

let h=read('public/cliente-central.html');

if(!h.includes('SAINTSAI_ONBOARDING_REFERENCE_V2')){
  h=h.replace('</style>',`
/* SAINTSAI_ONBOARDING_REFERENCE_V2 */
.setup-note{display:none!important}
#business-home{display:none}
.setup-wrap.hidden-setup + #business-home{display:block}
.reference-onboard{
  margin:0 0 18px;
  padding:28px 28px 24px;
  border-radius:28px;
  border:1px solid rgba(165,92,255,.32);
  background:
    radial-gradient(circle at 92% 2%,rgba(123,50,203,.16),transparent 30%),
    linear-gradient(145deg,rgba(39,18,64,.98),rgba(19,12,30,.99) 74%);
  box-shadow:0 20px 52px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.025);
}
.reference-onboard .onboard-top{
  display:flex;align-items:flex-start;justify-content:space-between;gap:18px
}
.reference-onboard .onboard-kicker{
  margin:0 0 12px;color:#a45eff;font-size:12px;line-height:1;
  letter-spacing:.15em;text-transform:uppercase;font-weight:950
}
.reference-onboard .onboard-title{
  margin:0;color:#fff;font-size:27px;line-height:1.08;font-weight:950;letter-spacing:-.035em
}
.reference-onboard .onboard-sub{
  max-width:520px;margin:10px 0 0;color:#aaa0b7;font-size:16px;line-height:1.5
}
.reference-onboard .onboard-pct{
  min-width:72px;padding-top:8px;text-align:right;color:#9f94aa;
  font-size:13px;line-height:1.35;font-weight:500;letter-spacing:0;white-space:normal
}
.reference-onboard .onboard-pct:before{
  content:'';display:block;width:29px;height:4px;margin:0 0 13px auto;border-radius:999px;background:#a15cff
}
.reference-onboard .onboard-track{
  height:10px;margin:25px 0 20px;border-radius:999px;overflow:hidden;
  background:rgba(102,44,155,.18);border:0
}
.reference-onboard .onboard-bar{
  height:100%;border-radius:999px;background:linear-gradient(90deg,#8837f4,#a950ff,#c47dff);
  box-shadow:0 0 18px rgba(166,73,255,.28)
}
.reference-onboard .onboard-steps{display:grid;gap:12px}
.reference-onboard .onboard-step{
  display:grid;grid-template-columns:42px minmax(0,1fr);align-items:center;gap:16px;
  min-height:104px;padding:18px 20px;border-radius:20px;
  border:1px solid rgba(255,255,255,.09);
  background:rgba(10,9,15,.70);box-shadow:none;cursor:pointer
}
.reference-onboard .onboard-step.next{
  border-color:rgba(161,88,255,.26);background:rgba(12,9,18,.78)
}
.reference-onboard .onboard-step.done{opacity:.82}
.reference-onboard .onboard-num{
  width:42px;height:42px;border-radius:50%;display:grid;place-items:center;
  background:rgba(105,35,187,.30);border:0;color:#b46dff;font-size:15px;font-weight:950
}
.reference-onboard .onboard-step.done .onboard-num{
  background:rgba(56,178,122,.16);color:#7de3b5
}
.reference-onboard .onboard-step-title{
  color:#fff;font-size:16px;line-height:1.2;font-weight:900;letter-spacing:-.015em
}
.reference-onboard .onboard-step-desc{
  margin-top:5px;color:#a69cac;font-size:14px;line-height:1.45
}
.reference-onboard .onboard-status{display:none!important}
.reference-onboard .onboard-action{
  width:100%;min-height:62px;margin-top:20px;border:0;border-radius:18px;
  background:linear-gradient(100deg,#8d2fff 0%,#a94eff 55%,#c477ff 100%);
  color:#fff;font:inherit;font-size:17px;font-weight:950;
  box-shadow:0 14px 30px rgba(137,47,255,.23);cursor:pointer
}
.reference-onboard .onboard-foot{
  margin-top:18px;color:#9f95aa;font-size:13px;line-height:1.5
}
@media(max-width:600px){
  .reference-onboard{padding:24px 20px 22px;border-radius:25px}
  .reference-onboard .onboard-title{font-size:25px}
  .reference-onboard .onboard-sub{font-size:15px}
  .reference-onboard .onboard-step{min-height:94px;padding:16px;grid-template-columns:40px minmax(0,1fr);gap:14px}
  .reference-onboard .onboard-num{width:40px;height:40px}
  .reference-onboard .onboard-step-title{font-size:15px}
  .reference-onboard .onboard-step-desc{font-size:13px}
}
</style>`);

  const start="    box.innerHTML='<div class=\"onboard ";
  const end="    box.querySelectorAll('[data-onboard]').forEach(el=>el.onclick=()=>onboardingDestino(el.dataset.onboard));";
  const si=h.indexOf(start);
  const ei=h.indexOf(end,si);
  if(si<0||ei<0)throw new Error('Render antigo do onboarding não encontrado');

  const replacement=`    const concluidas=Number(o.concluidas||etapas.filter(e=>e.concluida).length);
    const total=Number(o.total||etapas.length||0);
    const percentual=Number(o.percentual||0);
    const faltam=etapas.filter(e=>!e.concluida).length;
    const badge=$('notify-count');
    if(badge){badge.textContent=String(faltam);badge.classList.toggle('zero',faltam===0);}
    const zone=$('setup-zone');
    if(zone)zone.classList.toggle('hidden-setup',!!o.pronto);
    if(o.pronto){box.innerHTML='';return;}
    box.innerHTML='<div class="onboard reference-onboard">'+
      '<div class="onboard-top"><div><div class="onboard-kicker">COMECE POR AQUI</div>'+
      '<div class="onboard-title">Pronto para atender?</div>'+
      '<div class="onboard-sub">Conclua as etapas abaixo para deixar sua empresa pronta para funcionar com o SaintsAI.</div></div>'+
      '<div class="onboard-pct">'+concluidas+'/'+total+'<br>pronto</div></div>'+
      '<div class="onboard-track"><div class="onboard-bar" style="width:'+percentual+'%"></div></div>'+
      '<div class="onboard-steps">'+etapas.map((e,i)=>'<div class="onboard-step '+(e.concluida?'done ':'')+(e.id===next?'next':'')+'" data-onboard="'+e.destino+'">'+
        '<div class="onboard-num">'+(e.concluida?'✓':(i+1))+'</div><div><div class="onboard-step-title">'+e.titulo+'</div><div class="onboard-step-desc">'+e.descricao+'</div></div></div>').join('')+'</div>'+
      '<button class="onboard-action" data-onboard="'+(etapas.find(e=>e.id===next)?.destino||'inicio')+'">Continuar configuração</button>'+
      '<div class="onboard-foot">Você pode alterar essas configurações depois. Faça um teste antes de divulgar o atendimento.</div>'+
      '</div>';
    box.querySelectorAll('[data-onboard]').forEach(el=>el.onclick=()=>onboardingDestino(el.dataset.onboard));`;

  h=h.slice(0,si)+replacement+h.slice(ei+end.length);

  /* remove código duplicado de badge/zone inserido antes pelo patch anterior */
  h=h.replace(
    "const next=o.proxima;const faltam=(o.etapas||[]).filter(e=>!e.concluida).length;const badge=$('notify-count');if(badge){badge.textContent=String(faltam);badge.classList.toggle('zero',faltam===0);}const zone=$('setup-zone');if(zone)zone.classList.toggle('hidden-setup',!!o.pronto);",
    "const next=o.proxima;"
  );
}

write('public/cliente-central.html',h);
cp.execFileSync(process.execPath,['--check','src/controllers/clienteHub.controller.js'],{stdio:'inherit'});
console.log('Onboarding visual v2 aplicado no modelo da referência.');
