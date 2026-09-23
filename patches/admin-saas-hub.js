const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8');}
function write(p,s){fs.writeFileSync(p,s);}

let c=read('src/controllers/admin.controller.js');

c=c.replace(
  ".select('id, nome, dono_id, ativa, prompt_mestre')",
  ".select('id, nome, dono_id, ativa, prompt_mestre, agente_personalidade, agente_aviso, agente_aviso_ativo, numero_dono_whatsapp')"
);
c=c.replace(
  "prompt_mestre: loja.prompt_mestre || '',\n      whatsapp: configWa,",
  "prompt_mestre: loja.prompt_mestre || '',\n      personalidade: loja.agente_personalidade || 'amigavel',\n      numero_dono_whatsapp: loja.numero_dono_whatsapp || '',\n      whatsapp: configWa,"
);

if(!c.includes('async function atualizarContatosClienteGerenciado')) {
  const fn=`
const PERSONALIDADES_ADMIN = Object.freeze({
  amigavel: 'Seja amigável, acolhedor e claro, sem exagerar na informalidade.',
  profissional: 'Seja profissional, educado, objetivo e organizado.',
  direto: 'Seja direto e breve, priorizando respostas curtas e úteis.',
  casual: 'Seja casual e natural, com linguagem simples de conversa.',
  entusiasmado: 'Seja positivo e entusiasmado, sem pressionar o cliente.'
});

function normalizarNumeroAdmin(valor){
  return String(valor||'').replace(/\\D/g,'');
}

async function atualizarContatosClienteGerenciado(req,res){
  const lojaId=String(req.params.lojaId||'');
  const numeroDono=normalizarNumeroAdmin(req.body?.numero_dono_whatsapp);
  const numeroAgente=normalizarNumeroAdmin(req.body?.numero_whatsapp);

  if(!ehUuid(lojaId)) return res.status(400).json({erro:'Cliente inválido.'});
  if(numeroDono && (numeroDono.length<10 || numeroDono.length>15)) return res.status(400).json({erro:'Número do dono inválido.'});
  if(numeroAgente && (numeroAgente.length<10 || numeroAgente.length>15)) return res.status(400).json({erro:'Número do agente inválido.'});

  try{
    const {data:loja,error}=await supabase.from('lojas').select('id,dono_id').eq('id',lojaId).maybeSingle();
    if(error||!loja) return res.status(404).json({erro:'Cliente não encontrado.'});

    const {data:usuario}=await supabaseAuth.auth.admin.getUserById(loja.dono_id);
    if(!usuario?.user || usuario.user.app_metadata?.saintsai_managed!==true) return res.status(404).json({erro:'Cliente não encontrado.'});

    const {error:erroLoja}=await supabase.from('lojas').update({numero_dono_whatsapp:numeroDono||null}).eq('id',lojaId);
    if(erroLoja) throw erroLoja;

    if(numeroAgente){
      const {data:configs,error:erroConfigs}=await supabase.from('whatsapp_configuracoes')
        .select('id,ativo').eq('loja_id',lojaId).order('criado_em',{ascending:false});
      if(erroConfigs) throw erroConfigs;
      const atual=Array.isArray(configs)?(configs.find(x=>x.ativo)||configs[0]):null;
      if(atual){
        const {error:erroNumero}=await supabase.from('whatsapp_configuracoes')
          .update({numero_whatsapp:numeroAgente}).eq('id',atual.id).eq('loja_id',lojaId);
        if(erroNumero) throw erroNumero;
      }
    }
    return res.json({ok:true});
  }catch(erro){
    console.error('[admin] atualizar contatos:',erro?.name||'erro');
    return res.status(500).json({erro:'Não foi possível salvar os números do cliente.'});
  }
}

async function atualizarPersonalidadeClienteGerenciado(req,res){
  const lojaId=String(req.params.lojaId||'');
  const personalidade=String(req.body?.personalidade||'');
  if(!ehUuid(lojaId)) return res.status(400).json({erro:'Cliente inválido.'});
  if(!Object.prototype.hasOwnProperty.call(PERSONALIDADES_ADMIN,personalidade)) return res.status(400).json({erro:'Personalidade inválida.'});

  try{
    const {data:loja,error}=await supabase.from('lojas')
      .select('id,dono_id,prompt_mestre,agente_aviso,agente_aviso_ativo')
      .eq('id',lojaId).maybeSingle();
    if(error||!loja) return res.status(404).json({erro:'Cliente não encontrado.'});

    const {data:usuario}=await supabaseAuth.auth.admin.getUserById(loja.dono_id);
    if(!usuario?.user || usuario.user.app_metadata?.saintsai_managed!==true) return res.status(404).json({erro:'Cliente não encontrado.'});

    const base=String(loja.prompt_mestre||'')
      .replace(/\\n*\\[SAINTSAI_CONFIG_CLIENTE\\][\\s\\S]*?\\[\\/SAINTSAI_CONFIG_CLIENTE\\]\\n*/g,'\\n').trim();

    const linhas=[
      '[SAINTSAI_CONFIG_CLIENTE]',
      'PERSONALIDADE DO ATENDENTE: '+PERSONALIDADES_ADMIN[personalidade]
    ];
    if(loja.agente_aviso_ativo && loja.agente_aviso){
      linhas.push('AVISO TEMPORÁRIO DA LOJA: '+loja.agente_aviso);
      linhas.push('REGRA DO AVISO: use esse aviso somente quando for realmente relevante para a conversa.');
    }
    linhas.push('[/SAINTSAI_CONFIG_CLIENTE]');

    const prompt=[base,linhas.join('\\n')].filter(Boolean).join('\\n\\n');
    const {error:erroUpdate}=await supabase.from('lojas')
      .update({agente_personalidade:personalidade,prompt_mestre:prompt}).eq('id',lojaId);
    if(erroUpdate) throw erroUpdate;

    return res.json({ok:true,personalidade});
  }catch(erro){
    console.error('[admin] atualizar personalidade:',erro?.name||'erro');
    return res.status(500).json({erro:'Não foi possível salvar a personalidade.'});
  }
}
`;
  c=c.replace('\nasync function operacao(req, res) {',fn+'\nasync function operacao(req, res) {');
}

c=c.replace(/module\.exports\s*=\s*\{([^}]+)\};/, (m,inner)=>{
  const nomes=inner.split(',').map(s=>s.trim()).filter(Boolean);
  for(const n of ['atualizarContatosClienteGerenciado','atualizarPersonalidadeClienteGerenciado']){
    if(!nomes.includes(n)) nomes.push(n);
  }
  return 'module.exports = { '+nomes.join(', ')+' };';
});
write('src/controllers/admin.controller.js',c);

let r=read('src/routes/admin.routes.js');
if(!r.includes("clientes-gerenciados/:lojaId/contatos")){
  r=r.replace(
    "router.put('/clientes-gerenciados/:lojaId', exigirAdmin, controller.atualizarClienteGerenciado);",
    "router.put('/clientes-gerenciados/:lojaId', exigirAdmin, controller.atualizarClienteGerenciado);\n"+
    "router.put('/clientes-gerenciados/:lojaId/contatos', exigirAdmin, controller.atualizarContatosClienteGerenciado);\n"+
    "router.put('/clientes-gerenciados/:lojaId/personalidade', exigirAdmin, controller.atualizarPersonalidadeClienteGerenciado);"
  );
}
write('src/routes/admin.routes.js',r);

let admin=read('public/admin.html');
admin=admin.replace('<h2>Cadastrar cliente</h2>','<h2>Registrar novo cliente</h2>');
admin=admin.replace('<form id="admin-cliente-form"','<form id="admin-cliente-form" data-saints-register="1"');
admin=admin.replace('<section class="billing-card"><div class="admin-head"><h2>Empresas</h2>','<section class="billing-card" style="display:none"><div class="admin-head"><h2>Empresas</h2>');
if(!admin.includes('id="saints-admin-menu"')){
  admin=admin.replace('</body>',`
<style>
.saints-menu-btn{position:fixed;top:max(14px,env(safe-area-inset-top));left:14px;z-index:80;width:44px;height:44px;border:1px solid rgba(157,92,255,.35);border-radius:14px;background:rgba(14,11,22,.94);color:#fff;font-size:24px;display:grid;place-items:center}
.saints-drawer-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.52);z-index:88;display:none}
.saints-drawer{position:fixed;top:0;bottom:0;left:0;width:min(84vw,330px);z-index:90;background:#0d0a14;border-right:1px solid rgba(157,92,255,.28);padding:calc(24px + env(safe-area-inset-top)) 18px 24px;transform:translateX(-105%);transition:transform .2s ease}
.saints-drawer.open{transform:translateX(0)}.saints-drawer-backdrop.open{display:block}
.saints-drawer h2{margin:4px 0 20px;font-size:22px}.saints-drawer nav{display:grid;gap:9px}
.saints-drawer a{padding:13px 14px;border-radius:14px;color:#e9e4f1;text-decoration:none;background:rgba(255,255,255,.035);font-weight:700}
</style>
<button id="saints-menu-btn" class="saints-menu-btn" type="button" aria-label="Abrir menu">☰</button>
<div id="saints-menu-bg" class="saints-drawer-backdrop"></div>
<aside id="saints-admin-menu" class="saints-drawer">
<h2>Agente SaintsAI</h2>
<nav>
<a href="#admin-clientes-gerenciados">👥 Meus clientes</a>
<a href="#admin-cliente-form">＋ Registrar novo cliente</a>
<a href="configuracoes.html">⚙ Configurações</a>
</nav>
</aside>
<script>
(function(){
 const b=document.getElementById('saints-menu-btn'),m=document.getElementById('saints-admin-menu'),bg=document.getElementById('saints-menu-bg');
 function abrir(){m.classList.add('open');bg.classList.add('open');}
 function fechar(){m.classList.remove('open');bg.classList.remove('open');}
 b&&b.addEventListener('click',abrir);bg&&bg.addEventListener('click',fechar);
 m&&m.querySelectorAll('a').forEach(x=>x.addEventListener('click',fechar));
})();
</script>
</body>`);
}
write('public/admin.html',admin);

let ia=read('public/admin-cliente.html');
if(!ia.includes('id="cliente-personalidade"')){
  const alvo=`      <label>Prompt Mestre
        <textarea id="cliente-prompt" maxlength="12000" placeholder="Cole aqui as regras, personalidade, produtos, horários e orientações do atendimento."></textarea>
      </label>`;
  const novo=alvo+`
      <div>
        <strong>Personalidade do agente</strong>
        <div id="cliente-personalidade" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:9px">
          <label><input type="radio" name="personalidade" value="amigavel" checked> Amigável</label>
          <label><input type="radio" name="personalidade" value="profissional"> Profissional</label>
          <label><input type="radio" name="personalidade" value="direto"> Direto</label>
          <label><input type="radio" name="personalidade" value="casual"> Casual</label>
          <label><input type="radio" name="personalidade" value="entusiasmado"> Entusiasmado</label>
        </div>
        <small style="display:block;margin-top:8px;opacity:.68">O cliente poderá alterar isso depois no app de Estoque.</small>
      </div>`;
  if(!ia.includes(alvo)) throw new Error('Prompt Mestre do onboarding Admin não encontrado.');
  ia=ia.replace(alvo,novo);

  ia=ia.replace(
    "document.getElementById('cliente-nome').value=clienteDados.nome||'';",
    "document.getElementById('cliente-nome').value=clienteDados.nome||'';\n  document.querySelectorAll('input[name=\"personalidade\"]').forEach(x=>x.checked=(x.value===(clienteDados.personalidade||'amigavel')));"
  );

  ia=ia.replace(
    "await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId),{method:'PUT',body:JSON.stringify({nome,prompt_mestre:prompt,numero_whatsapp:''})});",
    "await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId),{method:'PUT',body:JSON.stringify({nome,prompt_mestre:prompt,numero_whatsapp:''})});\n  const personalidade=(document.querySelector('input[name=\"personalidade\"]:checked')||{}).value||'amigavel';\n  await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId)+'/personalidade',{method:'PUT',body:JSON.stringify({personalidade})});"
  );
}
write('public/admin-cliente.html',ia);

let wa=read('public/admin-cliente-whatsapp.html');
if(!wa.includes('id="numero-dono"')){
  wa=wa.replace('<strong>Número do WhatsApp</strong>','<strong>Número do agente (WhatsApp atendente)</strong>');
  wa=wa.replace(
    '<button id="gerar" class="btn-primary" type="button" style="width:100%;margin-top:12px">Gerar código de conexão</button>',
    '<div class="field" style="margin-top:12px"><label for="numero-dono"><strong>Número oficial do dono</strong></label><input id="numero-dono" type="tel" inputmode="tel" autocomplete="tel" placeholder="43 99999-9999"><small style="opacity:.68">Este número receberá os avisos de vencimento e renovação.</small></div><button id="gerar" class="btn-primary" type="button" style="width:100%;margin-top:12px">Gerar código de conexão</button>'
  );
  wa=wa.replace(
    "if(c.whatsapp&&c.whatsapp.numero_whatsapp)$('numero').value=c.whatsapp.numero_whatsapp;",
    "if(c.whatsapp&&c.whatsapp.numero_whatsapp)$('numero').value=c.whatsapp.numero_whatsapp;\n  if(c.numero_dono_whatsapp)$('numero-dono').value=c.numero_dono_whatsapp;"
  );
  wa=wa.replace(
    "const phone=$('numero').value.replace(/\\D/g,'');if(phone.length<10)return $('status').textContent='Digite um número válido com DDD.';",
    "const phone=$('numero').value.replace(/\\D/g,'');const dono=$('numero-dono').value.replace(/\\D/g,'');if(phone.length<10)return $('status').textContent='Digite um número válido do agente.';if(dono.length<10)return $('status').textContent='Digite o número oficial do dono.';"
  );
  wa=wa.replace(
    "try{\n  const r=await apiFetch('/lojas/'+encodeURIComponent(lojaId)+'/whatsapp/waha/pair'",
    "try{\n  await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId)+'/contatos',{method:'PUT',body:JSON.stringify({numero_whatsapp:phone,numero_dono_whatsapp:dono})});\n  const r=await apiFetch('/lojas/'+encodeURIComponent(lojaId)+'/whatsapp/waha/pair'"
  );
}
write('public/admin-cliente-whatsapp.html',wa);

let layout=read('public/js/layout.js');
layout=layout.replace(/\n\s*\{ id:'pedidos', label:'Pedidos', href:'pedidos\.html', icon:'pedidos' \},/g,'');
write('public/js/layout.js',layout);

let css=read('public/css/styles.css');
css=css.replace('grid-template-columns:repeat(4,minmax(0,1fr));','grid-template-columns:repeat(3,minmax(0,1fr));');
write('public/css/styles.css',css);

console.log('Painel SaaS reorganizado: menu hamburguer, clientes, personalidade e contatos.');
