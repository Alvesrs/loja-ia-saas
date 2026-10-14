(()=>{'use strict';
 function apply(){
  document.body.classList.add('sa-v7');
  if(document.getElementById('sa-connection-status'))return;
  const status=document.createElement('div');status.id='sa-connection-status';status.className='sa-connection-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='Sem conexão. Os dados podem estar desatualizados.';document.body.prepend(status);
  const update=()=>{status.hidden=navigator.onLine!==false;};update();window.addEventListener('offline',update);window.addEventListener('online',update);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
(()=>{'use strict';
 async function install(){
  if(!location.pathname.endsWith('cliente-whatsapp.html')||document.getElementById('sa-operation-summary'))return;
  const host=document.querySelector('.app');if(!host)return;
  const card=document.createElement('section');card.className='card';const title=document.createElement('h2');title.textContent='Processamento de mensagens';const summary=document.createElement('p');summary.id='sa-operation-summary';summary.setAttribute('role','status');summary.textContent='Consulte a fila para acompanhar o atendimento.';const button=document.createElement('button');button.type='button';button.className='btn2';button.textContent='Atualizar fila';card.append(title,summary,button);host.append(card);
  button.addEventListener('click',async()=>{button.disabled=true;summary.textContent='Consultando a fila…';try{const loja=await obterLojaAtual();if(!loja?.id)throw Error('store_missing');const x=await apiFetch('/lojas/'+encodeURIComponent(loja.id)+'/whatsapp/operacao');if(!x?.fila)throw Error('queue_unavailable');summary.textContent=`${x.fila.pendente||0} aguardando · ${x.fila.processando||0} em processamento · ${x.fila.falhou||0} com falha.${x.envios_a_conferir?' '+x.envios_a_conferir+' envio(s) precisam de conferência antes de tentar novamente.':''}${x.acessos_pendentes?' '+x.acessos_pendentes+' acesso(s) aguardam entrega.':''}${x.acessos_a_conferir?' '+x.acessos_a_conferir+' entrega(s) de acesso precisam de conferência.':''}`;}catch(_){summary.textContent='Não foi possível consultar a fila agora. Tente novamente.';}finally{button.disabled=false;}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

(()=>{'use strict';
 // Preserve the existing service form handler while blocking overlapping submissions.
 function protectServiceSave(){
  if(!location.pathname.endsWith('cliente-configuracao.html'))return;
  const button=document.getElementById('sv-add');if(!button||typeof button.onclick!=='function'||button.dataset.saSaveProtected==='true')return;
  const handler=button.onclick;let pending=false;button.dataset.saSaveProtected='true';
  button.onclick=async function(event){
   if(pending)return;pending=true;const disabled=button.disabled;button.disabled=true;
   try{return await handler.call(this,event);}finally{pending=false;if(button.isConnected)button.disabled=disabled;}
  };
 }
 function start(){if(!location.pathname.endsWith('cliente-configuracao.html'))return;protectServiceSave();new MutationObserver(protectServiceSave).observe(document.body,{childList:true,subtree:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
