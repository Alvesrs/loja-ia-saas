const fs=require('node:fs');
const p='public/admin-cliente-whatsapp.html';
let h=fs.readFileSync(p,'utf8');

const re=/\$\('gerar'\)\.onclick=async\(\)=>\{[\s\S]*?\n\};\n\$\('concluir'\)/;
const novo=`$('gerar').onclick=async()=>{
 const phone=$('numero').value.replace(/\\D/g,'');
 const donoCampo=$('numero-dono');
 const dono=donoCampo?donoCampo.value.replace(/\\D/g,''):'';
 if(phone.length<10){$('status').textContent='Digite um número válido do agente.';return;}
 if(dono.length<10){$('status').textContent='Digite o número oficial do dono.';return;}
 const b=$('gerar');
 b.disabled=true;
 b.textContent='Gerando código…';
 $('codigo').textContent='';
 $('status').textContent='';
 try{
  await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId)+'/contatos',{
   method:'PUT',
   body:JSON.stringify({numero_whatsapp:phone,numero_dono_whatsapp:dono})
  });
  const r=await apiFetch('/lojas/'+encodeURIComponent(lojaId)+'/whatsapp/waha/pair',{
   method:'POST',
   body:JSON.stringify({phone_number:phone})
  });
  if(!r||!r.code)throw new Error('Código de conexão não recebido.');
  $('codigo').textContent=r.code;
  $('status').textContent='Código gerado. Aguardando confirmação no WhatsApp.';
  await statusWa();
 }catch(e){
  if(e instanceof SessaoExpiradaError)return fazerLogout();
  $('status').textContent=e.message||'Não foi possível gerar o código.';
 }finally{
  b.disabled=false;
  b.textContent='Gerar código de conexão';
 }
};
$('concluir')`;

if(!re.test(h)) throw new Error('Handler de geração do código WhatsApp não encontrado.');
h=h.replace(re,novo);
fs.writeFileSync(p,h);
console.log('WhatsApp do cliente: handler final corrigido, incluindo numero do dono.');
