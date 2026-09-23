const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s);
let h=read('public/admin-mobile.html');

h=h.replace('<section id="view-registro" class="view hidden">','<section id="view-registro" class="view hidden"><div class="card"><h2>Tipo de cliente</h2><div class="chips"><button id="tipoAgente" class="chip active" type="button">🤖 Agente</button><button id="tipoGerenciador" class="chip" type="button">📊 Gerenciador</button></div><p id="tipoAjuda" class="sub" style="margin-top:10px">Agente de IA com Prompt Mestre e conexão de WhatsApp.</p></div>');

h=h.replace('<div class="card">\n   <h2>Prompt Mestre</h2>','<div id="managerConfig" class="card hidden"><h2>Gerenciador de vendas</h2><p class="sub">Funciona normalmente mesmo sem conectar WhatsApp.</p><div class="field"><label>Número usado para vendas (opcional)</label><input id="managerNumeroVendas" type="tel"></div><div class="field"><label>Número oficial do dono (opcional)</label><input id="managerNumeroDono" type="tel"></div><div class="field"><label>Como criar o login?</label><select id="managerLoginModo"><option value="admin">Criar login agora</option><option value="link">Cliente cria o próprio login por link</option></select></div><div class="field"><label>Nome público no ranking</label><input id="managerRankingNome" placeholder="Por padrão usa o nome da loja"></div><label style="display:flex;gap:10px;align-items:center;margin:12px 0"><input id="managerRanking" type="checkbox" checked> Participar do ranking SaintsAI</label><button id="criarGerenciador" class="btn primary" type="button">Criar Gerenciador</button><div id="managerStatus" class="status hidden"></div><div id="managerLinkBox" class="hidden"><div class="field"><label>Link para criar a conta</label><textarea id="managerLink" readonly></textarea></div><button id="copiarManagerLink" class="btn secondary" type="button">Copiar link</button></div></div><div class="card agentOnly">\n   <h2>Prompt Mestre</h2>');
h=h.replace('<div class="card"><h2>Personalidade do agente</h2>','<div class="card agentOnly"><h2>Personalidade do agente</h2>');
h=h.replace('<div class="card"><h2>Números de contato</h2>','<div class="card agentOnly"><h2>Números de contato</h2>');
h=h.replace('<div class="card"><h2>Plano e duração</h2>','<div class="card agentOnly"><h2>Plano e duração</h2>');
h=h.replace('<div class="card"><h2>Pagamento</h2>','<div class="card agentOnly"><h2>Pagamento</h2>');
h=h.replace('<div id="waCard" class="card">','<div id="waCard" class="card agentOnly">');

const js=`
let tipoCliente='agente';
function setTipoCliente(tipo){
 tipoCliente=tipo;
 $('tipoAgente').classList.toggle('active',tipo==='agente');$('tipoGerenciador').classList.toggle('active',tipo==='gerenciador');
 $('managerConfig').classList.toggle('hidden',tipo!=='gerenciador');
 document.querySelectorAll('.agentOnly').forEach(x=>x.classList.toggle('hidden',tipo!=='agente'));
 $('criar').classList.toggle('hidden',tipo==='gerenciador');
 $('tipoAjuda').textContent=tipo==='agente'?'Agente de IA com Prompt Mestre e conexão de WhatsApp.':'Gerenciador de vendas, clientes, lucros, gráficos e ranking. WhatsApp é opcional.';
 const link=tipo==='gerenciador'&&$('managerLoginModo').value==='link';
 $('email').closest('.field').classList.toggle('hidden',link);$('senha').closest('.field').classList.toggle('hidden',link);
}
$('tipoAgente').onclick=()=>setTipoCliente('agente');
$('tipoGerenciador').onclick=()=>setTipoCliente('gerenciador');
$('managerLoginModo').onchange=()=>setTipoCliente('gerenciador');
$('copiarManagerLink').onclick=async()=>{try{await navigator.clipboard.writeText($('managerLink').value);$('managerStatus').className='status ok';$('managerStatus').textContent='Link copiado.'}catch(_){$('managerLink').select();document.execCommand('copy')}};
$('criarGerenciador').onclick=async()=>{
 const st=$('managerStatus'),nome=$('nome').value.trim(),link=$('managerLoginModo').value==='link';st.className='status';st.classList.remove('hidden');
 if(nome.length<2){st.textContent='Informe o nome da loja.';return}
 const payload={nome,numero_vendas_whatsapp:$('managerNumeroVendas').value,numero_dono_whatsapp:$('managerNumeroDono').value,ranking_participa:$('managerRanking').checked,ranking_nome_publico:$('managerRankingNome').value.trim()};
 if(!link){payload.email=$('email').value.trim().toLowerCase();payload.senha=$('senha').value;if(!payload.email||payload.senha.length<6){st.textContent='Preencha e-mail e senha.';return}}
 const b=$('criarGerenciador');b.disabled=true;st.textContent=link?'Gerando link…':'Criando Gerenciador…';
 try{const r=await apiFetch('/gerenciador/admin/'+(link?'convite':'direto'),{method:'POST',body:JSON.stringify(payload)});
  if(link){$('managerLink').value=new URL(r.link,location.href).href;$('managerLinkBox').classList.remove('hidden');st.className='status ok';st.textContent='Convite criado. Envie o link para o cliente.'}
  else{st.className='status ok';st.textContent='Gerenciador criado. O WhatsApp pode ser conectado depois.';await loadClients();}
 }catch(e){if(e instanceof SessaoExpiradaError)return fazerLogout();st.textContent=e.message||'Não foi possível concluir.'}finally{b.disabled=false}
};
setTipoCliente('agente');
`;
h=h.replace("const th=$('adminTheme');",js+"\nconst th=$('adminTheme');");
write('public/admin-mobile.html',h);

let ac=read('src/controllers/admin.controller.js');
ac=ac.replace(".select('id, nome, dono_id, ativa, prompt_mestre, criado_em')",".select('id, nome, dono_id, ativa, prompt_mestre, criado_em, modo_operacao, numero_vendas_whatsapp')");
ac=ac.replace("criado_em: loja.criado_em\n      };","criado_em: loja.criado_em,\n        modo_operacao: loja.modo_operacao || 'agente',\n        numero_vendas_whatsapp: loja.numero_vendas_whatsapp || null\n      };");
write('src/controllers/admin.controller.js',ac);
console.log('Manager admin UI v1 aplicada.');
