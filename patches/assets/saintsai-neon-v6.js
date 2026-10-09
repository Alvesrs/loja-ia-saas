/* Presentation only: keep existing nodes, IDs, requests and event handlers. */
(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s);
function build(){
 if(document.body.classList.contains('sa-neon'))return;
 document.body.classList.add('sa-neon');
 const welcome=$('.sa-welcome');
 if(welcome){
  const title=$('h1',welcome);if(title)title.innerHTML='Seu negócio.<br><span>Um passo à frente.</span>';
  const eye=$('.sa-eyebrow',welcome);if(eye)eye.textContent='SEU ESPAÇO SAINTSAI';
  const symbol=$('.sa-hero-symbol',welcome);if(symbol)symbol.classList.add('neon-orb');
  const link=$('.sa-new',welcome);if(link)link.textContent='+ Novo agendamento';
 }
 const home=$('#business-home');
 if(home&&!$('.neon-overview',home)){
  const row=document.createElement('div');row.className='neon-overview';row.setAttribute('aria-label','Resumo do negócio');
  ['sa-received','sa-sold','sa-pending','sa-clients'].forEach(id=>{const n=$('#'+id)?.closest('.sa-stat');if(n)row.append(n)});
  const tabs=$('.st-tabs',home);if(tabs)tabs.before(row);else home.prepend(row);
  const pulse=$('.st-pulse',home);if(pulse&&!pulse.children.length)pulse.remove();
  const figures=$('.rm-figures',home);if(figures&&!figures.children.length)figures.remove();
  const day=$('#st-day',home),integration=$('.sa-integrations',home)?.closest('section');
  if(day&&integration){const workspace=$('.rm-workspace',day);if(workspace){workspace.append(integration);workspace.classList.add('neon-client-workspace');$('.rm-connections',home)?.remove()}}
  const actions=$('.rm-actions',home);if(actions){const heading=document.createElement('div');heading.className='neon-section-label';heading.textContent='Tudo para o seu negócio';actions.before(heading)}
 }
 const central=$('#saas-central');
 if(central&&!$('.neon-admin-hero',central)){
  const hero=document.createElement('section');hero.className='neon-admin-hero';
  hero.innerHTML='<div><span class="neon-kicker">SAINTSAI · ADMINISTRADOR</span><h1>Visão completa.<br><span>Mais possibilidades.</span></h1><p>Clientes, receitas e oportunidades em um só lugar.</p><a class="neon-cta" href="admin-cliente-cadastro.html">+ Adicionar cliente</a></div><div class="neon-hero-art" aria-hidden="true"><span>✦</span><i></i><b>SAINTSAI</b></div>';
  central.prepend(hero);
  const pulse=$(".st-owner-pulse",central);if(pulse)hero.after(pulse);
  const head=$('.saas-head',central);if(head&&head.parentElement===central)head.classList.add('neon-legacy-head');
  const command=$('.st-owner-command',central);if(command)command.classList.add('neon-admin-command');
 }
 document.querySelectorAll('.sa-stat').forEach((el,i)=>{el.style.setProperty('--neon-index',i);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>queueMicrotask(build));else build();
})();
