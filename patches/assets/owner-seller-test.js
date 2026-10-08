(()=>{
 const select=document.getElementById('store'),button=document.getElementById('restart'),status=document.getElementById('status');let phone=null;
 const normalize=v=>{const n=String(v||'').replace(/\D/g,'');return n.length===12&&/^55\d{2}[6-9]/.test(n)?n.slice(0,4)+'9'+n.slice(4):n;};
 function openWhatsApp(number){
  if(!/^55\d{10,11}$/.test(String(number||'')))throw Error('Número de teste indisponível. Atualize a página.');
  const bridge=typeof window.AndroidAgent?.openWhatsApp==='function'?window.AndroidAgent:window.AndroidClient;
  if(typeof bridge?.openWhatsApp==='function'){bridge.openWhatsApp(number);return;}
  // Opening must happen inside the user's click, before any asynchronous request.
  const url='https://api.whatsapp.com/send?phone='+number;
  const opened=window.open(url,'_blank');
  if(!opened){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.textContent='Abrir WhatsApp';status.append(document.createElement('br'),a);}
 }
 Promise.all([apiFetch('/admin/vendedor-teste'),apiFetch('/admin/prospeccao/minhas-lojas')]).then(([info,r])=>{
  phone=normalize(info.telefone);
  document.getElementById('number').textContent=info.exibicao;select.replaceChildren(new Option('Selecione sua loja',''));for(const l of r.lojas)select.add(new Option(l.nome,l.id));const saved=localStorage.getItem('saintsai-owner-seller-store');if(r.lojas.some(l=>l.id===saved))select.value=saved;else if(r.lojas.length===1)select.value=r.lojas[0].id;button.disabled=false;
 }).catch(e=>{status.textContent=e.message;});
 button.onclick=async()=>{
  if(button.disabled)return;if(!select.value){status.textContent='Selecione sua loja com o WhatsApp conectado.';select.focus();return;}
  button.disabled=true;status.textContent='Reiniciando o agente. Aguarde a nova apresentação no WhatsApp…';
  try{
   const id=crypto.randomUUID();
   // Start the request, then launch WhatsApp synchronously in the same click.
   const request=apiFetch('/admin/vendedor-teste/reiniciar',{method:'POST',body:JSON.stringify({lojaId:select.value,requestId:id})});
   try{openWhatsApp(phone);}catch(_){status.textContent='Não foi possível abrir o WhatsApp automaticamente. Aguarde o reinício e toque em Abrir WhatsApp.';}
   const result=await request;phone=normalize(result.telefone||phone);
   status.textContent='Novo teste iniciado. Responda à apresentação no WhatsApp.';
   const again=document.createElement('button');again.type='button';again.textContent='Abrir WhatsApp';again.onclick=()=>openWhatsApp(phone);status.append(document.createElement('br'),again);
  }catch(e){status.textContent='O teste não foi reiniciado: '+e.message;}finally{button.disabled=false;}
 };
})();
