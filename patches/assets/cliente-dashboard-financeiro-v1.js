(function(){
  function safe(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]})}
  function money(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
  function statusFinanceiro(a){
    if(a.status==='cancelado')return {label:'Cancelado',cls:'cancel'};
    if(a.status==='nao_compareceu')return {label:'No-show',cls:'warn'};
    if(a.pagamento_status==='pago')return {label:'Recebido',cls:'ok'};
    if(a.pagamento_status==='estornado')return {label:'Estornado',cls:'cancel'};
    if(a.status==='concluido'&&a.pagamento_status==='presencial')return {label:'Recebido presencial',cls:'ok'};
    if(a.pagamento_status==='aguardando')return {label:'Aguardando Pix',cls:'warn'};
    if(a.pagamento_status==='presencial')return {label:'Pagamento no atendimento',cls:'neutral'};
    return {label:'Pendente',cls:'warn'};
  }
  function when(v){
    try{return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}
    catch(_){return ''}
  }

  var live=document.getElementById('business-home');
  if(live){
    live.innerHTML=
      '<div class="finance-dashboard">'+
        '<div class="finance-grid finance-grid-primary">'+
          '<article class="finance-card"><div class="finance-label">Vendido hoje</div><div class="finance-value" id="fin-sold-today">R$ 0,00</div><div class="finance-foot" id="fin-sold-today-foot">Nenhum registro hoje</div></article>'+
          '<article class="finance-card"><div class="finance-label">Recebido hoje</div><div class="finance-value" id="fin-received-today">R$ 0,00</div><div class="finance-foot" id="fin-received-today-foot">Nenhum pagamento confirmado</div></article>'+
          '<article class="finance-card"><div class="finance-label">A receber</div><div class="finance-value" id="fin-pending">R$ 0,00</div><div class="finance-foot" id="fin-pending-foot">Nenhum pagamento em aberto</div></article>'+
          '<article class="finance-card"><div class="finance-label">Cancelado hoje</div><div class="finance-value" id="fin-cancel-today">R$ 0,00</div><div class="finance-foot" id="fin-cancel-today-foot">Nenhum cancelamento hoje</div></article>'+
        '</div>'+
        '<div class="finance-grid finance-grid-secondary">'+
          '<article class="finance-mini"><span>Clientes de hoje</span><strong id="fin-clients-today">0</strong></article>'+
          '<article class="finance-mini"><span>Ticket médio no mês</span><strong id="fin-ticket">R$ 0,00</strong></article>'+
          '<article class="finance-mini"><span>Vendido no mês</span><strong id="fin-sold-month">R$ 0,00</strong></article>'+
        '</div>'+
        '<section class="finance-month"><div class="finance-section-head"><div><h2>Resumo do mês</h2><p>Visão financeira separando venda, recebimento e valores em aberto.</p></div><a href="cliente-agenda.html">Abrir agenda</a></div>'+
          '<div class="finance-month-grid">'+
            '<div><span>Vendido</span><strong id="fin-month-sold">R$ 0,00</strong></div>'+
            '<div><span>Recebido</span><strong id="fin-month-received">R$ 0,00</strong></div>'+
            '<div><span>Pendente</span><strong id="fin-month-pending">R$ 0,00</strong></div>'+
            '<div><span>Cancelado</span><strong id="fin-month-cancel">R$ 0,00</strong></div>'+
          '</div>'+
        '</section>'+
        '<section class="finance-feed"><div class="finance-section-head"><div><h2>Registros recentes</h2><p>Os novos atendimentos aparecem aqui com o estado financeiro real.</p></div></div><div id="fin-records"><div class="finance-empty">Carregando registros…</div></div></section>'+
      '</div>';
  }

  carregarHomeNegocio=async function(){
    if(!loja)return;
    try{
      var x=await apiFetch('/lojas/'+loja.id+'/cliente-financeiro');
      var set=function(id,value){var el=document.getElementById(id);if(el)el.textContent=value};
      set('fin-sold-today',money(x.hoje?.vendido));
      set('fin-received-today',money(x.hoje?.recebido));
      set('fin-pending',money(x.aberto?.receber));
      set('fin-cancel-today',money(x.hoje?.cancelado));
      set('fin-clients-today',String(Number(x.hoje?.clientes||0)));
      set('fin-ticket',money(x.mes?.ticket_medio));
      set('fin-sold-month',money(x.mes?.vendido));
      set('fin-month-sold',money(x.mes?.vendido));
      set('fin-month-received',money(x.mes?.recebido));
      set('fin-month-pending',money(x.mes?.pendente));
      set('fin-month-cancel',money(x.mes?.cancelado));
      set('fin-sold-today-foot',(x.hoje?.vendido_quantidade||0)+' venda'+((x.hoje?.vendido_quantidade||0)===1?'':'s')+' registrada'+((x.hoje?.vendido_quantidade||0)===1?'':'s')+' hoje');
      set('fin-received-today-foot',(x.hoje?.recebido_quantidade||0)+' pagamento'+((x.hoje?.recebido_quantidade||0)===1?'':'s')+' confirmado'+((x.hoje?.recebido_quantidade||0)===1?'':'s')+' hoje');
      set('fin-pending-foot',(x.aberto?.quantidade||0)+' pagamento'+((x.aberto?.quantidade||0)===1?'':'s')+' em aberto');
      set('fin-cancel-today-foot',(x.hoje?.cancelado_quantidade||0)+' cancelamento'+((x.hoje?.cancelado_quantidade||0)===1?'':'s')+' hoje');

      var records=document.getElementById('fin-records');
      if(records){
        var arr=x.registros||[];
        records.innerHTML=arr.length?arr.map(function(a){
          var st=statusFinanceiro(a);
          var media=a.imagem_url
            ? '<img class="finance-record-img" src="'+safe(a.imagem_url)+'" alt="">'
            : '<div class="finance-record-img finance-record-fallback">✦</div>';
          var prof=a.profissional?' · '+safe(a.profissional):'';
          return '<div class="finance-record">'+media+
            '<div class="finance-record-main"><div class="finance-record-name">'+safe(a.nome)+'</div><div class="finance-record-sub">'+safe(a.servico)+prof+' · '+safe(when(a.inicio))+'</div><span class="finance-badge '+st.cls+'">'+safe(st.label)+'</span></div>'+
            '<div class="finance-record-value">'+money(a.valor)+'</div>'+
          '</div>';
        }).join(''):'<div class="finance-empty">Nenhum registro ainda.</div>';
      }
    }catch(e){
      var records=document.getElementById('fin-records');
      if(records)records.innerHTML='<div class="finance-empty">Não foi possível carregar o resumo financeiro agora.</div>';
    }
  };

  function start(){
    try{
      if(typeof loja!=='undefined'&&loja){carregarHomeNegocio();return true}
    }catch(_){}
    return false;
  }
  if(!start()){
    var tries=0;
    var timer=setInterval(function(){tries++;if(start()||tries>30)clearInterval(timer)},200);
  }
  setInterval(function(){
    try{if(document.body.dataset.clientView==='inicio')carregarHomeNegocio()}catch(_){}
  },30000);
})();