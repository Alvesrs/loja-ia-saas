
(function(){
  function safe(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

  var brand=document.querySelector('.brand');
  if(brand)brand.textContent='SaintsAI Dashboard';

  var live=document.getElementById('business-home');
  if(live){
    live.innerHTML=
      '<div class="dashboard-live">'+
        '<div class="dash-stats">'+
          '<div class="dash-stat"><div class="dash-stat-label">Clientes de hoje</div><div class="dash-stat-value" id="dash-clientes-hoje">0</div><div class="dash-stat-foot">Atendimentos registrados para hoje</div></div>'+
          '<div class="dash-stat"><div class="dash-stat-label">Vendas de hoje</div><div class="dash-stat-value" id="dash-vendas-hoje">R$ 0,00</div><div class="dash-stat-foot">Valor dos registros do dia</div></div>'+
        '</div>'+
        '<div class="dash-feed"><h2>Registros recentes</h2><div class="dash-feed-sub">Cada novo atendimento aparece aqui.</div><div id="dash-registros"><div class="dash-empty">Carregando registros…</div></div></div>'+
      '</div>';
  }

  carregarOnboarding=async function(){
    var box=document.getElementById('onboarding-real');
    if(!box||!loja)return;
    try{
      var o=await apiFetch('/lojas/'+loja.id+'/cliente-hub/onboarding');
      var pendentes=(o.etapas||[]).filter(function(e){return !e.concluida;});
      var badge=document.getElementById('notify-count');
      if(badge){
        badge.textContent=String(pendentes.length);
        badge.classList.toggle('zero',pendentes.length===0);
      }
      var zone=document.getElementById('setup-zone');
      if(zone)zone.classList.toggle('hidden-setup',!!o.pronto);
      if(o.pronto){
        box.innerHTML='';
        await carregarHomeNegocio();
        return;
      }

      box.innerHTML=
        '<div class="dashboard-setup">'+
          '<div class="dash-setup-head"><div><div class="dash-setup-kicker">CONFIGURE SEU SAINTSAI</div><div class="dash-setup-title">Deixe seu negócio pronto</div></div><div class="dash-setup-pct">'+Number(o.percentual||0)+'%</div></div>'+
          '<div class="dash-track"><i style="width:'+Number(o.percentual||0)+'%"></i></div>'+
          '<div class="dash-tasks">'+pendentes.map(function(e,i){
            return '<button class="dash-task" data-onboard="'+safe(e.destino)+'">'+
              '<span class="dash-task-num">'+(i+1)+'</span>'+
              '<span><span class="dash-task-title">'+safe(e.titulo)+'</span><span class="dash-task-desc">'+safe(e.descricao)+'</span></span>'+
              '<span class="dash-task-go">›</span>'+
            '</button>';
          }).join('')+'</div>'+
        '</div>';

      box.querySelectorAll('[data-onboard]').forEach(function(el){
        el.onclick=function(){onboardingDestino(el.dataset.onboard);};
      });
    }catch(e){
      box.innerHTML='<div class="dash-empty">Não foi possível carregar a configuração agora.</div>';
    }
  };

  carregarHomeNegocio=async function(){
    if(!loja)return;
    try{
      var x=await apiFetch('/lojas/'+loja.id+'/cliente-hub/inicio');
      var c=document.getElementById('dash-clientes-hoje');
      var v=document.getElementById('dash-vendas-hoje');
      var r=document.getElementById('dash-registros');
      if(c)c.textContent=String(Number(x.clientes_hoje||0));
      if(v)v.textContent=dinheiro(x.vendas_hoje||0);
      var regs=x.registros||[];
      if(r){
        r.innerHTML=regs.length?regs.map(function(a){
          var media=a.imagem_url
            ? '<img class="dash-record-img" src="'+safe(a.imagem_url)+'" alt="">'
            : '<div class="dash-record-img dash-record-fallback">✦</div>';
          var when=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(a.inicio));
          return '<div class="dash-record">'+media+
            '<div><div class="dash-record-name">'+safe(a.nome)+'</div><div class="dash-record-sub">'+safe(a.servico)+' · '+safe(when)+'</div></div>'+
            '<div class="dash-record-money">+'+dinheiro(a.valor)+'</div>'+
          '</div>';
        }).join(''):'<div class="dash-empty">Nenhum registro ainda.</div>';
      }
    }catch(e){
      var r=document.getElementById('dash-registros');
      if(r)r.innerHTML='<div class="dash-empty">Não foi possível carregar os registros agora.</div>';
    }
  };

  function atualizarQuandoPronto(){
    try{
      if(typeof loja!=='undefined'&&loja){
        carregarOnboarding();
        carregarHomeNegocio();
        return true;
      }
    }catch(_){}
    return false;
  }

  if(!atualizarQuandoPronto()){
    var tentativas=0;
    var timer=setInterval(function(){
      tentativas++;
      if(atualizarQuandoPronto()||tentativas>30)clearInterval(timer);
    },200);
  }

  setInterval(function(){
    try{
      if(document.body.dataset.clientView==='inicio')carregarHomeNegocio();
    }catch(_){}
  },30000);
})();
