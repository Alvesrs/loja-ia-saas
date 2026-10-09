(()=>{
 'use strict';
 function start(){
  if(document.body.dataset.clientRemaster)return;
  document.body.dataset.clientRemaster='v5';document.body.classList.add('sa-client-v5');
  try{if(!localStorage.getItem('lojaia-tema')&&window.LojaIATheme)window.LojaIATheme.aplicar('escuro');}catch(_){}
  const auth=document.querySelector('.login-sub');if(auth)auth.textContent='Seu atendimento e sua agenda, em um só lugar. Entre com a conta da sua empresa.';
  const title=document.querySelector('.sa-welcome h1');if(title)title.textContent='Seu dia, em ordem.';
  const setup=document.querySelector('#setup-zone'),home=document.querySelector('#business-home');
  if(setup&&home&&home.contains(setup))home.prepend(setup);
  // Services lead the mobile navigation; all secondary modules remain in the menu.
  let menu=document.querySelector('#sa-menu');
  if(!menu&&document.querySelector('.sa-mobile-nav,.gallery-nav')){
   menu=document.createElement('dialog');menu.id='sa-menu';menu.className='sa-menu';menu.setAttribute('aria-label','Seu negócio');
   const head=document.createElement('div');head.className='sa-menu-head';
   const heading=document.createElement('strong');heading.textContent='Seu negócio';
   const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Fechar menu');close.onclick=()=>menu.close();head.append(heading,close);menu.append(head);document.body.append(menu);
   menu.addEventListener('click',event=>{if(event.target!==menu)return;const r=menu.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)menu.close();});
  }
  if(menu){
   for(const [name,url] of [['Serviços e profissionais','cliente-configuracao.html?etapa=servicos'],['Produtos','cliente-produtos.html'],['Galeria de fotos e vídeos','cliente-galeria.html'],['Conectar WhatsApp','cliente-whatsapp.html'],['Pagamentos','cliente-configuracao.html?etapa=pagamentos'],['Perfil da empresa','cliente-marca.html'],['Plano e cobrança','cliente-plano.html']]){
    if([...menu.querySelectorAll('a')].some(a=>a.getAttribute('href')===url))continue;
    const a=document.createElement('a');a.href=url;a.textContent=name;const logout=menu.querySelector('.sa-menu-logout');if(logout)logout.before(a);else menu.append(a);
   }
  }
  for(const nav of document.querySelectorAll('.sa-mobile-nav,.gallery-nav')){
   const links=[...nav.querySelectorAll('a')];
   const pick=file=>links.find(a=>a.getAttribute('href')?.split('?')[0]===file);
   const selected=[pick('cliente-central.html'),pick('cliente-agenda.html'),pick('cliente-agente.html')].filter(Boolean);
   if(selected.length!==3||!menu)continue;
   const more=document.createElement('button');more.type='button';more.setAttribute('aria-label','Abrir menu do negócio');more.setAttribute('aria-haspopup','dialog');more.setAttribute('aria-controls','sa-menu');more.className='sa-business-menu';more.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Negócio</span>';more.onclick=()=>menu.showModal();
   if(!selected.some(a=>a.classList.contains('current')))more.classList.add('current');
   nav.replaceChildren(...selected,more);nav.setAttribute('aria-label','Navegação do SaintsAI Cliente');
   for(const a of selected){const label=a.querySelector('span');if(label&&a.getAttribute('href')==='cliente-central.html')label.textContent='Início';}
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
