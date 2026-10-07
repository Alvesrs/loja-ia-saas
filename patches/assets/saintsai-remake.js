(()=>{
'use strict';
const $=s=>document.querySelector(s),el=(tag,cls)=>{const n=document.createElement(tag);n.className=cls;return n;};
const svg=(name)=>'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+({box:'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10',gallery:'M3 4h18v16H3z M4 17l5-5 5 4 3-3 4 4 M7 8h2',calendar:'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16',spark:'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',home:'M3 10l9-7 9 7v10H3z M9 20v-7h6v7',people:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 5a4 4 0 0 1 0 8 M22 21v-3a4 4 0 0 0-3-4',radar:'M12 3a9 9 0 1 0 9 9 M12 7a5 5 0 1 0 5 5 M12 12l9-9 M17 3h4v4',settings:'M4 7h16 M4 17h16 M8 4v6 M16 14v6',arrow:'M5 12h14 M14 7l5 5-5 5'})[name]+'"/></svg>';
function client(){
 document.body.classList.add('rm-client');
 if(!$('.sa-mobile-nav')&&!$('.gallery-nav')){const nav=el('nav','sa-mobile-nav rm-shared-nav');nav.setAttribute('aria-label','Menu principal');const page=location.pathname.split('/').pop();for(const [name,file,icon] of [['Início','cliente-central.html','home'],['Produtos','cliente-produtos.html','box'],['Galeria','cliente-galeria.html','gallery'],['Agenda','cliente-agenda.html','calendar'],['Agente IA','cliente-agente.html','spark']]){const a=el('a',page===file?'current':'');a.href=file;a.innerHTML=svg(icon)+'<span>'+name+'</span>';if(page===file)a.setAttribute('aria-current','page');nav.append(a);}document.body.append(nav);}
 const catalogBrand=$('.cliente-brand');if(catalogBrand)catalogBrand.textContent='Catálogo · SaintsAI';
 const redundant=$('.cliente-tabs');if(redundant)redundant.remove();
 const home=$('#business-home');if(!home||!$('#sa-received'))return;
 document.body.classList.add('rm-client-home');
 const title=$('.sa-welcome h1');if(title)title.textContent='Seu negócio. Sob controle.';
 const release=$('.sa-release');if(release)release.remove();
 const eyebrow=$('.sa-welcome .sa-eyebrow');if(eyebrow)eyebrow.textContent='SEU ESPAÇO';
 const overview=el('section','rm-overview');overview.setAttribute('aria-label','Resumo financeiro de hoje');
 const received=$('#sa-received').closest('.sa-stat');received.classList.add('rm-balance');received.querySelector('.sa-stat-label').textContent='Recebido hoje';
 const kicker=el('span','rm-kicker');kicker.textContent='RESULTADO DO DIA';received.prepend(kicker);
 const receiptLink=el('a','rm-balance-link');receiptLink.href='cliente-configuracao.html?etapa=pagamentos';receiptLink.innerHTML='Ver recebimentos '+svg('arrow');received.append(receiptLink);overview.append(received);
 const figures=el('div','rm-figures');for(const id of ['sa-sold','sa-pending','sa-clients']){const stat=$('#'+id)?.closest('.sa-stat');if(stat)figures.append(stat);}overview.append(figures);
 const workspace=el('div','rm-workspace');const today=$('.sa-today-v5');if(today)workspace.append(today);
 const side=el('div','rm-context');const month=$('#sa-month-name')?.closest('section');if(month)side.append(month);
 const connections=$('.sa-integrations')?.closest('section');if(connections){const details=el('details','rm-connections');const summary=el('summary','');summary.textContent='Conexões do atendimento';details.append(summary,connections);side.append(details);}workspace.append(side);
 const records=$('#sa-records')?.closest('section');if(records)records.classList.add('rm-records');
 const setup=$('#setup-zone'),push=$('#client-push-settings');if(push&&!window.AndroidClient)push.hidden=true;
 // Move existing nodes: values, event listeners and asynchronous updates remain intact.
 const oldGrid=$('.sa-stat-grid'),oldMain=$('.sa-main-grid'),shortcuts=$('.sa-shortcuts');
 const actions=el('nav','rm-actions');actions.setAttribute('aria-label','Atalhos de atendimento');
 for(const [name,url,note] of [['Serviços','cliente-configuracao.html?etapa=servicos','Preços e duração'],['Galeria','cliente-galeria.html','Fotos e vídeos'],['WhatsApp','cliente-whatsapp.html','Seu atendimento']]){const a=el('a','rm-action');a.href=url;const text=el('span','');const strong=el('strong','');strong.textContent=name;const small=el('small','');small.textContent=note;text.append(strong,small);a.append(text);a.insertAdjacentHTML('beforeend',svg('arrow'));actions.append(a);}
 home.append(overview,actions);if(setup)home.append(setup);if(push)home.append(push);home.append(workspace);if(records)home.append(records);
 oldGrid?.remove();oldMain?.remove();shortcuts?.remove();
 const brand=$('.sa-sidebar .sa-logo small');if(brand)brand.textContent='Seu negócio';
 document.querySelectorAll('.sa-side-links a[href="cliente-estoque.html"]').forEach(a=>a.remove());
 const footer=$('.sa-side-footer small');if(footer)footer.textContent='Seu atendimento, organizado.';
}
function admin(){
 document.body.classList.add('rm-admin');if($('#drawer'))document.body.classList.add('rm-admin-workspace');
 const brand=$('.saintsHeader .saintsBrand');if(brand){const by=brand.querySelector('.saintsBy');if(by)by.textContent='CENTRAL DE GESTÃO';}
 const header=$('.saintsHeader');if(header){const actions=el('div','rm-header-actions');const refresh=el('button','rm-interface-update');refresh.type='button';refresh.id='rm-interface-update';refresh.setAttribute('aria-label','Atualizar interface');refresh.title='Atualizar interface';refresh.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 7v5h-5 M4 17v-5h5 M6 8a7 7 0 0 1 12-2l2 6 M18 16a7 7 0 0 1-12 2l-2-6"/></svg>';refresh.onclick=async()=>{refresh.disabled=true;try{const r=await fetch('admin-versao.json',{cache:'no-store'});if(!r.ok)throw Error('version');const v=await r.json();if(typeof v.versao!=='string')throw Error('version');const url=new URL(location.href);url.searchParams.set('atualizacao',v.versao);url.searchParams.set('recarregar',String(Date.now()));location.replace(url.href);}catch(_){refresh.disabled=false;refresh.title='Não foi possível atualizar. Tente novamente.';}};actions.append(refresh);const menu=$('#menuBtn');if(menu)actions.append(menu);header.append(actions);}
 const pane=$('#saas-central');if(pane){
  const head=pane.querySelector('.saas-head');if(head){const h=head.querySelector('h2');if(h)h.textContent='Sua operação, em foco.';const p=head.querySelector('p');if(p)p.textContent='Acompanhe clientes, receita e o crescimento do SaintsAI.';const label=el('span','rm-kicker');label.textContent='VISÃO DO NEGÓCIO';head.firstElementChild?.prepend(label);}
  const metrics=pane.querySelector('.saas-metrics');if(metrics){const total=$('#saas-mes')?.closest('.saas-metric');if(total){total.classList.add('rm-admin-revenue');metrics.prepend(total);}metrics.classList.add('rm-admin-metrics');}
  const clients=pane.querySelector('.saas-clients');if(clients){const heading=el('div','rm-section-heading');heading.innerHTML='<span class="rm-kicker">CARTEIRA</span><h2>Seus clientes</h2><p>Abra um cliente para cuidar da conta e do atendimento.</p>';const controls=pane.querySelector('.saas-controls');(controls||clients).before(heading);}
 }
 const feedback=$('#saas-message');if(feedback){feedback.classList.add('rm-global-status');$('.saintsHeader')?.after(feedback);}
 const clientSection=$('#saas-client-section'),clientView=$('#view-clientes');
 if(pane&&clientSection&&clientView){for(const child of [...clientView.children])child.classList.add('hidden');clientView.append(clientSection);const refresh=el('button','btn secondary rm-clients-refresh');refresh.type='button';refresh.textContent='Atualizar clientes';refresh.onclick=()=>window.SaintsAICentral?.load();clientSection.querySelector('.rm-section-heading')?.append(refresh);const heading=clientSection.querySelector(':scope > h2');if(heading)heading.remove();
 const original=typeof showView==='function'?showView:null;
 if(original)showView=function(v){if(v==='clientes'||v==='assinaturas'){document.querySelectorAll('.view').forEach(n=>n.classList.add('hidden'));clientView.classList.remove('hidden');document.querySelectorAll('.nav button[data-view]').forEach(n=>n.classList.remove('active'));$('#clientesMenuBtn')?.classList.add('active');location.hash='clientes';if(typeof closeDrawer==='function')closeDrawer();if(v==='assinaturas'){const f=$('#saas-filter');if(f){f.value='ativos';f.dispatchEvent(new Event('change'));}}}else{$('#clientesMenuBtn')?.classList.remove('active');original(v);}};
 const quick=el('nav','rm-owner-actions');quick.setAttribute('aria-label','Ações do negócio');quick.innerHTML='<button type="button" data-owner-clients><span>Clientes</span><small>Gerenciar sua carteira</small>'+svg('people')+'</button><a href="admin-prospeccao.html"><span>Prospecção</span><small>Encontrar oportunidades</small>'+svg('radar')+'</a><a href="admin-cliente-cadastro.html"><span>Novo cliente</span><small>Cadastrar uma empresa</small>'+svg('arrow')+'</a>';quick.querySelector('button').onclick=()=>showView('clientes');pane.querySelector('.saas-metrics')?.after(quick);
 }
 const dock=el('nav','rm-admin-dock');dock.setAttribute('aria-label','Navegação principal');
 for(const [name,icon,view,url] of [['Visão geral','home','home'],['Clientes','people','clientes'],['Prospecção','radar',null,'admin-prospeccao.html'],['Ajustes','settings','config']]){const b=el(url?'a':'button','');b.innerHTML=svg(icon)+'<span>'+name+'</span>';if(url){b.href=url;if(location.pathname.includes('prospeccao')){b.classList.add('current');b.setAttribute('aria-current','page');}}else{b.type='button';b.dataset.rmView=view;b.onclick=()=>{if(typeof showView==='function')showView(view);else location.href='admin-mobile.html#'+view;sync();};}dock.append(b);}
 const sync=()=>{const selected=location.pathname.includes('prospeccao')?'prospeccao':location.hash.slice(1)||'home';dock.querySelectorAll('[data-rm-view]').forEach(b=>{const active=b.dataset.rmView===selected;b.classList.toggle('current',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});};
 document.body.append(dock);window.addEventListener('hashchange',sync);sync();
 const update=$('#admin-update-bar');const config=$('#view-config');if(update&&config){update.classList.add('rm-update-settings');config.append(update);}
 const drawer=$('#drawer');if(drawer){for(const [id,name] of [['clientesMenuBtn','Clientes'],['estoqueMenuBtn','Catálogos de clientes']]){const b=$('#'+id);if(b)b.textContent=name;}drawer.querySelectorAll('.nav>button[onclick]').forEach(b=>{const action=b.getAttribute('onclick')||'';if(action.includes('gerenciador-contas'))b.textContent='Gerenciador de vendas';if(action.includes('admin-leads'))b.textContent='Leads e orientações';});const prospect=drawer.querySelector('a[href="admin-prospeccao.html"]');if(prospect)prospect.textContent='Prospecção';const heading=drawer.querySelector('.saintsBy');if(heading)heading.textContent='GESTÃO SAINTSAI';drawer.querySelectorAll('.nav>button').forEach(b=>{const labels={home:'Visão geral',vendas:'Recebimentos',registro:'Cadastrar cliente',teste:'Conta de teste',assinaturas:'Assinaturas',config:'Configurações'};if(labels[b.dataset.view])b.textContent=labels[b.dataset.view];});}
}
function start(){if(document.body.dataset.rmReady)return;document.body.dataset.rmReady='true';const file=location.pathname.split('/').pop();if(/login|cadastro|registro/.test(file)){document.body.classList.add(file.startsWith('admin')?'rm-admin':'rm-client','rm-auth-flow');return;}if(file.startsWith('admin'))admin();else client();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
