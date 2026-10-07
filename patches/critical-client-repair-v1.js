const fs=require('node:fs');
function edit(p,fn){fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));}
fs.copyFileSync('patches/assets/clientDeletion.service.js','src/services/clientDeletion.service.js');
edit('src/controllers/admin.controller.js',s=>{const a=s.indexOf('async function excluirClienteGerenciado('),b=s.indexOf('\nasync function ',a+1);if(a<0||b<0)throw Error('Exclusão não encontrada');return s.slice(0,a)+`async function excluirClienteGerenciado(req,res){
 const id=String(req.params.lojaId||'');if(!ehUuid(id))return res.status(400).json({erro:'Cliente inválido.'});
 try{return res.json(await require('../services/clientDeletion.service').excluir(id,req.usuario));}
 catch(e){console.error('[admin] excluir cliente:',e.message);return res.status(e.status||503).json({erro:e.status?e.message:'Não foi possível excluir o cliente.'});}
}
`+s.slice(b);});
edit('src/services/wahaOnboarding.service.js',s=>{const a=s.indexOf('function canonNumero('),b=s.indexOf('\nasync function liberarNumeroEmOutrasLojas',a);if(a<0||b<0)throw Error('Normalizador ausente');s=s.slice(0,a)+`function canonNumero(valor){
 let d=String(valor||'').replace(/\\D/g,'');if(d.length===10||d.length===11)d='55'+d;
 // WhatsApp sometimes omits the ninth mobile digit in the Brazilian account JID.
 if(/^55\\d{2}9[6-9]\\d{7}$/.test(d))d=d.slice(0,4)+d.slice(5);
 return d;
}
`+s.slice(b);s=s.replace('if(id.numero===fone)','if(canonNumero(id.numero)===canonNumero(fone))');
 const pre='  await liberarNumeroEmOutrasLojas(lojaId,fone);\n  await obterOuCriarConfig(lojaId,fone,sessao);\n';s=s.replace(pre,'');s=s.replace("  if(existente.ok&&st==='FAILED'){",pre+"\n  if(existente.ok&&st==='FAILED'){");return s.replace('module.exports={iniciarPareamento,','module.exports={canonNumero,iniciarPareamento,');});
edit('public/admin-prospeccao.html',s=>{
 s=s.replace("x.motivos.map(m=>", "(Array.isArray(x.motivos)?x.motivos:[]).map(m=>");
 s=s.replace("esc(x.whatsapp)","esc('https://wa.me/'+String(x.telefone||'').replace(/\\D/g,''))");
 // Keep a full result set so a previous local discard cannot silently hide all contacts.
 s=s.replace('let ultimo=[],soSalvos=false;','let ultimo=[],resultadoBusca=[],soSalvos=false;');
 s=s.replace("ultimo=(r.leads||[]).slice(0,10).filter(x=>estado()[x.id]!=='descartado');", "resultadoBusca=(r.leads||[]).filter(x=>/^55\\d{10,11}$/.test(String(x.telefone||'').replace(/\\D/g,''))).slice(0,10);ultimo=resultadoBusca.filter(x=>estado()[x.id]!=='descartado');$('restaurar').hidden=!resultadoBusca.some(x=>estado()[x.id]==='descartado');");
 s=s.replace('<div id="cards" class="cards"></div>','<button id="restaurar" class="ghost" type="button" hidden>Restaurar contatos descartados</button><div id="cards" class="cards"></div>');
 s=s.replace("$('buscar').onclick=buscar;", "$('restaurar').onclick=()=>{const st=estado();for(const x of resultadoBusca)if(st[x.id]==='descartado')delete st[x.id];salvarEstado(st);ultimo=resultadoBusca;soSalvos=false;$('restaurar').hidden=true;render();};\n$('buscar').onclick=buscar;");
 return s.replace(/js\/(config|auth|api|owner-prospecting)\.js\?v=[^\"']+/g,'js/$1.js?v=2026.10.07.12');
});
// Replace native confirm/alert dependence with an explicit dialog rendered in the page.
edit('public/admin-cliente.html',s=>{const a=s.indexOf("document.getElementById('cliente-excluir')?.addEventListener("),b=s.indexOf('\n</script>',a);if(a<0||b<0)throw Error('Botão excluir ausente');return s.slice(0,a)+`document.getElementById('cliente-excluir')?.addEventListener('click',()=>{
 const d=document.createElement('dialog');d.innerHTML='<p>Excluir a conta e os dados deste cliente?</p><p role="status"></p><button type="button" data-cancel>Cancelar</button> <button type="button" data-confirm>Excluir cliente</button>';document.body.append(d);d.showModal();
 d.querySelector('[data-cancel]').onclick=()=>{d.close();d.remove();};
 d.querySelector('[data-confirm]').onclick=async()=>{const b=d.querySelector('[data-confirm]');b.disabled=true;d.querySelector('[role=status]').textContent='Excluindo…';
 try{await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId),{method:'DELETE'});localStorage.removeItem('lojaAtual');location.href='admin-mobile.html#clients';}
 catch(e){d.querySelector('[role=status]').textContent=e.message||'Não foi possível excluir.';b.disabled=false;}};
});`+s.slice(b);});
for(const t of ['admin','cliente'])edit('public/'+t+'-versao.json',s=>{const v=JSON.parse(s);v.versao='2026.10.07.12';return JSON.stringify(v);});
console.log('Exclusão de clientes, contatos visíveis e identidade brasileira corrigidos.');

edit('src/server.js',s=>s+"\nsetTimeout(()=>require('../patches/verify-and-clean-clients-20261007.js')().catch(e=>console.error('[repair.live] FALHOU:',String(e.message||'erro').slice(0,200))),1500);\n");
