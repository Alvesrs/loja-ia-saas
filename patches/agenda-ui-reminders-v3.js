const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}
let h=read('public/cliente-central.html');

if(!h.includes('ah-rem24')){
  h=h.replace(
    '<div class="field"><label>Intervalo da grade (min)</label><input id="ah-grade" type="number" min="5" max="240" value="30"></div><button class="btn" id="ah-save" style="margin-top:14px">Salvar horários</button>',
    '<div class="field"><label>Intervalo da grade (min)</label><input id="ah-grade" type="number" min="5" max="240" value="30"></div><div class="switches" style="margin-top:12px"><label><input id="ah-rem24" type="checkbox" checked> Lembrar cliente 24h antes e pedir confirmação</label><label><input id="ah-rem2" type="checkbox" checked> Lembrar cliente cerca de 2h antes</label></div><button class="btn" id="ah-save" style="margin-top:14px">Salvar horários</button>'
  );
  h=h.replace(
    '<div class="field"><label>Data e hora</label><input id="ag-inicio" type="datetime-local"></div>',
    '<div class="field"><label>Data e hora</label><input id="ag-inicio" type="datetime-local"><small class="muted">Escolha entre hoje e até 1 mês à frente.</small></div>'
  );
  h=h.replace(
    "function renderAgendaConfig(){const cfg=dados.agenda_config||{};const hs=cfg.horarios||{};document.querySelectorAll('.agenda-dia').forEach(row=>{const x=hs[row.dataset.dia]||{};row.querySelector('.ah-open').checked=x.aberto===true;row.querySelector('.ah-ini').value=x.inicio||'09:00';row.querySelector('.ah-fim').value=x.fim||'18:00';});$('ah-grade').value=Number(cfg.intervalo_grade_min||30);}",
    "function renderAgendaConfig(){const cfg=dados.agenda_config||{};const hs=cfg.horarios||{};document.querySelectorAll('.agenda-dia').forEach(row=>{const x=hs[row.dataset.dia]||{};row.querySelector('.ah-open').checked=x.aberto===true;row.querySelector('.ah-ini').value=x.inicio||'09:00';row.querySelector('.ah-fim').value=x.fim||'18:00';});$('ah-grade').value=Number(cfg.intervalo_grade_min||30);$('ah-rem24').checked=cfg.lembrete_24h!==false;$('ah-rem2').checked=cfg.lembrete_2h!==false;aplicarLimitesAgenda();}"
  );
  h=h.replace(
    "body:JSON.stringify({horarios,intervalo_grade_min:Number($('ah-grade').value||30)})",
    "body:JSON.stringify({horarios,intervalo_grade_min:Number($('ah-grade').value||30),lembrete_24h:$('ah-rem24').checked,lembrete_2h:$('ah-rem2').checked})"
  );
}

if(!h.includes('function aplicarLimitesAgenda')){
  h=h.replace(
    "function dinheiro(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}",
    "function dinheiro(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}\nfunction pad2(n){return String(n).padStart(2,'0')}\nfunction agendaDatas(){const a=new Date();const min=a.getFullYear()+'-'+pad2(a.getMonth()+1)+'-'+pad2(a.getDate());let y=a.getFullYear(),m=a.getMonth()+2,d=a.getDate();if(m>12){m=1;y++;}const ultimo=new Date(y,m,0).getDate();d=Math.min(d,ultimo);const max=y+'-'+pad2(m)+'-'+pad2(d);return {min,max};}\nfunction aplicarLimitesAgenda(){const x=agendaDatas(),min=x.min+'T00:00',max=x.max+'T23:59';const novo=$('ag-inicio');if(novo){novo.min=min;novo.max=max;}document.querySelectorAll('.ag-edit-time').forEach(i=>{i.min=min;i.max=max;});}"
  );
  h=h.replace(":'<div class=\"muted\">Nenhum agendamento para gerenciar.</div>';}",
              ":'<div class=\"muted\">Nenhum agendamento para gerenciar.</div>';aplicarLimitesAgenda();}");
}

write('public/cliente-central.html',h);
console.log('Controles de lembrete e limite de 1 mês aplicados ao SaintsAI Cliente.');
