(()=>{'use strict';
 function apply(){
  document.body.classList.add('sa-v7');
  if(document.getElementById('sa-connection-status'))return;
  const status=document.createElement('div');status.id='sa-connection-status';status.className='sa-connection-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='Sem conexão. Os dados podem estar desatualizados.';document.body.prepend(status);
  const update=()=>{status.hidden=navigator.onLine!==false;};update();window.addEventListener('offline',update);window.addEventListener('online',update);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
