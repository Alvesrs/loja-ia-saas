const fs=require('node:fs');
const p='public/admin-mobile.html';
let h=fs.readFileSync(p,'utf8');

const chooser=`<div id="clientModeChooser" class="card"><h2>Tipo de cliente</h2><p class="sub">Escolha qual produto SaintsAI esta empresa vai usar.</p><div class="chips"><button id="modeAgent" class="chip active" type="button">🤖 Agente</button><button id="modeManager" class="chip" type="button">📊 Gerenciador</button></div><div id="modeHelp" class="note" style="margin-top:10px">Agente de IA com Prompt Mestre e atendimento pelo WhatsApp.</div></div><div id="managerConfig" class="card hidden"><h2>Gerenciador de vendas</h2><p class="sub">Funciona normalmente sem WhatsApp. Se conectar depois, o sistema poderá acompanhar negociações e sugerir vendas.</p><div class="field"><label>Número usado para vendas (opcional)</label><input id="managerSalesPhone" type="tel" placeholder="Ex: (41) 99999-9999"></div><div class="field"><label>Número oficial do dono (opcional)</label><input id="managerOwnerPhone" type="tel" placeholder="Para confirmar vendas duvidosas"></div><div class="field"><label>Criação do login</label><select id="managerLoginMode"><option value="admin">Eu crio o login agora</option><option value="link">Cliente cria o próprio login pelo link</option></select></div><div class="field"><label>Nome público no ranking</label><input id="managerRankName" placeholder="Por padrão: nome da loja"></div><label style="display:flex;gap:10px;align-items:center;margin:12px 0"><input id="managerRanking" type="checkbox" checked> Participar do ranking SaintsAI</label><button id="managerCreate" class="btn primary" type="button">Criar Gerenciador</button><div id="managerStatus" class="status hidden"></div><div id="managerLinkBox" class="hidden"><div class="field"><label>Link para criar a conta</label><textarea id="managerLink" readonly></textarea></div><button id="managerCopy" class="btn secondary" type="button">Copiar link</button></div></div>`;
const promptNeedle='<div class="card"><h2>Prompt Mestre</h2>';
if(!h.includes('id="clientModeChooser"')&&h.includes(promptNeedle))h=h.replace(promptNeedle,chooser+promptNeedle);

const js=`
let registrationMode='agente';
function managerCards(){
 const titles=['Prompt Mestre','Personalidade do agente','Números de contato','Plano e duração','Pagamento','WhatsApp'];
 return Array.from(document.querySelectorAll('#view-registro .card')).filter(c=>{const x=c.querySelector('h2');return x&&titles.includes(x.textContent.trim())});
}
function applyRegistrationMode(mode){
 registrationMode=mode;
 const isManager=mode==='gerenciador';
 $('modeAgent').classList.toggle('active',!isManager);$('modeManager').classList.toggle('active',isManager);
 $('managerConfig').classList.toggle('hidden',!isManager);managerCards().forEach(c=>c.classList.toggle('hidden',isManager));
 $('modeHelp').textContent=isManager?'Gerenciador de vendas, clientes, lucro, gráficos e ranking. WhatsApp é opcional.':'Agente de IA com Prompt Mestre e atendimento pelo WhatsApp.';
 $('criar').classList.toggle('hidden',isManager);
 const linkMode=isManager&&$('managerLoginMode').value==='link';
 const ef=$('email')?.closest('.field'),sf=$('senha')?.closest('.field');
 if(ef)ef.classList.toggle('hidden',linkMode);if(sf)sf.classList.toggle('hidden',linkMode);
}
$('modeAgent').onclick=()=>applyRegistrationMode('agente');$('modeManager').onclick=()=>applyRegistrationMode('gerenciador');$('managerLoginMode').onchange=()=>applyRegistrationMode('gerenciador');
$('managerCopy').onclick=async()=>{const v=$('managerLink').value;try{await navigator.clipboard.writeText(v);$('managerStatus').className='status ok';$('managerStatus').textContent='Link copiado.'}catch(_){$('managerLink').select();document.execCommand('copy')}};
$('managerCreate').onclick=async()=>{
 const st=$('managerStatus'),nome=$('nome').value.trim(),linkMode=$('managerLoginMode').value==='link';st.className='status';st.classList.remove('hidden');
 if(nome.length<2){st.textContent='Informe o nome da loja.';return}
 const payload={nome,numero_vendas_whatsapp:$('managerSalesPhone').value,numero_dono_whatsapp:$('managerOwnerPhone').value,ranking_participa:$('managerRanking').checked,ranking_nome_publico:$('managerRankName').value.trim()};
 if(!linkMode){payload.email=$('email').value.trim().toLowerCase();payload.senha=$('senha').value;if(!payload.email||payload.senha.length<6){st.textContent='Preencha e-mail e senha.';return}}
 const b=$('managerCreate');b.disabled=true;st.textContent=linkMode?'Gerando link…':'Criando Gerenciador…';
 try{
  const r=await apiFetch('/gerenciador/admin/'+(linkMode?'convite':'direto'),{method:'POST',body:JSON.stringify(payload)});
  if(linkMode){$('managerLink').value=new URL(r.link,location.href).href;$('managerLinkBox').classList.remove('hidden');st.className='status ok';st.textContent='Convite criado. Envie este link para o cliente criar o login.'}
  else{st.className='status ok';st.textContent='Gerenciador criado. O WhatsApp pode ser conectado depois, se quiser.';await loadClients()}
 }catch(e){if(e instanceof SessaoExpiradaError)return fazerLogout();st.textContent=e.message||'Não foi possível concluir.'}finally{b.disabled=false}
};
applyRegistrationMode('agente');
`;
if(!h.includes("let registrationMode='agente'"))h=h.replace("const th=$('adminTheme');",js+"\nconst th=$('adminTheme');");
fs.writeFileSync(p,h);

let c=fs.readFileSync('src/controllers/admin.controller.js','utf8');
c=c.replace(".select('id, nome, dono_id, ativa, prompt_mestre, criado_em')",".select('id, nome, dono_id, ativa, prompt_mestre, criado_em, modo_operacao, numero_vendas_whatsapp')");
c=c.replace("criado_em: loja.criado_em\n      };","criado_em: loja.criado_em,\n        modo_operacao: loja.modo_operacao || 'agente',\n        numero_vendas_whatsapp: loja.numero_vendas_whatsapp || null\n      };");
fs.writeFileSync('src/controllers/admin.controller.js',c);

console.log('Manager admin UI v1 aplicado: escolha Agente/Gerenciador.');