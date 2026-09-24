const fs=require('node:fs');
const p='public/admin-mobile.html';
let h=fs.readFileSync(p,'utf8');

const re=/\$\('criarTeste'\)\.onclick=async\(\)=>\{[\s\S]*?\n\nloadClients\(\)/;
const replacement=`$('criarTeste').onclick=async()=>{
 const st=$('testStatus'),b=$('criarTeste');
 st.className='status';st.classList.remove('hidden');
 const nome=$('tnome').value.trim(),email=$('temail').value.trim().toLowerCase(),senha=$('tsenha').value,prompt=$('tprompt').value.trim(),agente=digits($('tagente').value),dono=digits($('tdono').value);
 if(nome.length<2||!email||senha.length<6||!prompt||agente.length<10||dono.length<10){st.textContent='Preencha todos os dados do teste.';return}
 b.disabled=true;st.textContent='Preparando registro teste…';
 try{
  let id=null;
  try{
   const r=await apiFetch('/admin/clientes',{method:'POST',body:JSON.stringify({nome,email,senha})});
   id=r?.loja?.id||null;
  }catch(e){
   const msg=String(e?.message||'').toLowerCase();
   if(!msg.includes('já está cadastrado')&&!msg.includes('ja esta cadastrado')&&!msg.includes('already')){
    throw e;
   }
   const xs=await apiFetch('/admin/clientes-gerenciados');
   const existente=(Array.isArray(xs)?xs:[]).find(c=>String(c.email||c.username||'').trim().toLowerCase()===email);
   if(!existente?.loja_id){
    throw new Error('Esse login já existe, mas não está vinculado a um cliente gerenciado do SaintsAI.');
   }
   id=existente.loja_id;
   st.textContent='Login existente encontrado. Atualizando o registro de teste…';
  }
  if(!id)throw new Error('Loja de teste não disponível.');

  await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({nome,prompt_mestre:prompt,numero_whatsapp:''})});
  await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(id)+'/personalidade',{method:'PUT',body:JSON.stringify({personalidade:'amigavel'})});
  await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(id)+'/contatos',{method:'PUT',body:JSON.stringify({numero_whatsapp:agente,numero_dono_whatsapp:dono})});
  const validade=$('tvalidade').value;if(!validade)throw new Error('Escolha a data de validade do teste.');const d=new Date(validade+'T23:59:59');if(Number.isNaN(d.getTime()))throw new Error('Data de validade inválida.');
  await apiFetch('/admin/lojas/'+encodeURIComponent(id)+'/assinatura',{method:'PUT',body:JSON.stringify({plano:'trial',status:'ativo',valido_ate:d.toISOString()})});

  st.className='status ok';st.textContent='Teste liberado por 24 horas. Abrindo WhatsApp…';
  await loadClients();
  setTimeout(()=>location.href='admin-cliente-whatsapp.html?loja='+encodeURIComponent(id),500);
 }catch(e){
  if(e instanceof SessaoExpiradaError)return fazerLogout();
  st.textContent=e.message||'Não foi possível criar o teste.';
 }finally{b.disabled=false}
};

loadClients()`;

if(!re.test(h)) throw new Error('Fluxo Registro Teste não encontrado no painel final.');
h=h.replace(re,replacement);
fs.writeFileSync(p,h);
console.log('Registro Teste: cliente existente agora é reutilizado em vez de bloquear.');
