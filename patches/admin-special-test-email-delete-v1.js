const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

const TEST_EMAIL='saintsai.owner.lab.7x9q4m2v6k@agente.com';

const controllerPath='src/controllers/admin.controller.js';
let c=read(controllerPath);

// Email especial de teste: cada uso cria um login interno único, evitando colisão no Supabase Auth.
if(!c.includes("const SAINTSAI_TEST_EMAIL = 'saintsai.owner.lab.7x9q4m2v6k@agente.com';")){
  c=c.replace("const supabaseAuth = require('../config/supabaseAuth');","const supabaseAuth = require('../config/supabaseAuth');\nconst SAINTSAI_TEST_EMAIL = 'saintsai.owner.lab.7x9q4m2v6k@agente.com';");
}

const emailLine="  const email = String(req.body?.email || '').trim().toLowerCase();";
if(c.includes(emailLine) && !c.includes('emailSolicitado')){
  c=c.replace(emailLine,[
    "  const emailSolicitado = String(req.body?.email || '').trim().toLowerCase();",
    "  const emailEhTeste = emailSolicitado === SAINTSAI_TEST_EMAIL;",
    "  const sufixoTeste = Date.now().toString(36) + Math.random().toString(36).slice(2,8);",
    "  const email = emailEhTeste ? ('saintsai.owner.lab.7x9q4m2v6k+' + sufixoTeste + '@agente.com') : emailSolicitado;"
  ].join('\n'));
}

// Marcação da conta de teste no Auth e retorno do e-mail real de login.
c=c.replace(
  "      app_metadata: { saintsai_managed: true },",
  "      app_metadata: { saintsai_managed: true, saintsai_test: emailEhTeste },"
);
c=c.replace(
  "      user_metadata: username ? { username } : {},",
  "      user_metadata: emailEhTeste ? { username, email_teste_modelo: SAINTSAI_TEST_EMAIL } : (username ? { username } : {}),"
);
c=c.replace(
  "      cliente: { id: userId, email, username: username || null },",
  "      cliente: { id: userId, email, username: username || null, teste: emailEhTeste, email_modelo: emailEhTeste ? SAINTSAI_TEST_EMAIL : null },"
);

// Exclusão administrativa completa do cliente.
if(!c.includes('async function excluirClienteGerenciado')){
  const fn=[
    "async function excluirClienteGerenciado(req,res){",
    "  const lojaId=String(req.params.lojaId||'');",
    "  if(!ehUuid(lojaId)) return res.status(400).json({erro:'Cliente inválido.'});",
    "  try{",
    "    const {data:loja,error}=await supabase.from('lojas').select('id,dono_id,nome').eq('id',lojaId).maybeSingle();",
    "    if(error||!loja) return res.status(404).json({erro:'Cliente não encontrado.'});",
    "    const {data:usuario}=await supabaseAuth.auth.admin.getUserById(loja.dono_id);",
    "    if(!usuario?.user || usuario.user.app_metadata?.saintsai_managed!==true) return res.status(404).json({erro:'Cliente não encontrado.'});",
    "",
    "    const del=async(tabela,coluna='loja_id')=>{const {error:e}=await supabase.from(tabela).delete().eq(coluna,lojaId);if(e)throw new Error(tabela+': '+e.message);};",
    "",
    "    const {data:pedidos}=await supabase.from('pedidos').select('id').eq('loja_id',lojaId);",
    "    const pedidoIds=(pedidos||[]).map(x=>x.id);",
    "    if(pedidoIds.length){const {error:e}=await supabase.from('pedido_itens').delete().in('pedido_id',pedidoIds);if(e)throw e;}",
    "",
    "    const {data:produtos}=await supabase.from('produtos').select('id').eq('loja_id',lojaId);",
    "    const produtoIds=(produtos||[]).map(x=>x.id);",
    "    if(produtoIds.length){const {data:ests,error:e0}=await supabase.from('estoque').select('id').in('produto_id',produtoIds);if(e0)throw e0;const estIds=(ests||[]).map(x=>x.id);if(estIds.length){const {error:e1}=await supabase.from('pedido_itens').delete().in('estoque_id',estIds);if(e1)throw e1;const {error:e2}=await supabase.from('venda_itens').delete().in('estoque_id',estIds);if(e2)throw e2;}const {error:e3}=await supabase.from('venda_itens').delete().in('produto_id',produtoIds);if(e3)throw e3;const {error:e4}=await supabase.from('estoque').delete().in('produto_id',produtoIds);if(e4)throw e4;}",
    "",
    "    const tabelas=['saintsai_sales_conversations','whatsapp_fila_processamento','whatsapp_mensagens','whatsapp_conversas','whatsapp_credenciais','renovacao_avisos','renovacao_sessoes','cobrancas_assinaturas','venda_itens','vendas','gerenciador_convites','assinaturas','whatsapp_configuracoes','pedidos','clientes','produtos'];",
    "    for(const t of tabelas) await del(t);",
    "",
    "    const {error:erroLoja}=await supabase.from('lojas').delete().eq('id',lojaId);",
    "    if(erroLoja) throw erroLoja;",
    "    const {error:erroUser}=await supabaseAuth.auth.admin.deleteUser(loja.dono_id);",
    "    if(erroUser) throw erroUser;",
    "    return res.json({ok:true,excluido:true});",
    "  }catch(erro){console.error('[admin] excluir cliente:',erro?.message||erro);return res.status(500).json({erro:'Não foi possível excluir o cliente completamente.'});}",
    "}"
  ].join('\n');
  c=c.replace('\nasync function operacao(req, res) {','\n'+fn+'\n\nasync function operacao(req, res) {');
}

c=c.replace(/module\.exports\s*=\s*\{([^}]+)\};/, (m,inner)=>{
  const nomes=inner.split(',').map(x=>x.trim()).filter(Boolean);
  if(!nomes.includes('excluirClienteGerenciado')) nomes.push('excluirClienteGerenciado');
  return 'module.exports = { '+nomes.join(', ')+' };';
});
write(controllerPath,c);

let routes=read('src/routes/admin.routes.js');
if(!routes.includes("router.delete('/clientes-gerenciados/:lojaId'")){
  routes=routes.replace(
    "router.get('/clientes-gerenciados/:lojaId', exigirAdmin, controller.obterClienteGerenciado);",
    "router.get('/clientes-gerenciados/:lojaId', exigirAdmin, controller.obterClienteGerenciado);\nrouter.delete('/clientes-gerenciados/:lojaId', exigirAdmin, controller.excluirClienteGerenciado);"
  );
}
write('src/routes/admin.routes.js',routes);

// Registro Teste: sugere o e-mail especial e sempre cria um novo teste quando ele for usado.
const mobilePath='public/admin-mobile.html';
let h=read(mobilePath);
if(h.includes('id="temail"')){
  h=h.replace('id="temail" type="email"','id="temail" type="email" placeholder="'+TEST_EMAIL+'"');
}
if(!h.includes('SAINTSAI_TEST_EMAIL_SPECIAL')){
  h=h.replace('</script>','<script>window.SAINTSAI_TEST_EMAIL_SPECIAL="'+TEST_EMAIL+'";<\/script></script>');
}
// Evita o fluxo antigo de reutilizar cliente para esse e-mail e mostra o login interno criado.
const needle="   const r=await apiFetch('/admin/clientes',{method:'POST',body:JSON.stringify({nome,email,senha})});\n   id=r?.loja?.id||null;";
if(h.includes(needle)){
  h=h.replace(needle,needle+"\n   if(email===window.SAINTSAI_TEST_EMAIL_SPECIAL && r?.cliente?.email){st.textContent='Novo teste criado. Login deste teste: '+r.cliente.email;}");
}
const catchNeedle="   if(!msg.includes('já está cadastrado')&&!msg.includes('ja esta cadastrado')&&!msg.includes('already')){";
if(h.includes(catchNeedle)){
  h=h.replace(catchNeedle,"   if(email===window.SAINTSAI_TEST_EMAIL_SPECIAL) throw e;\n"+catchNeedle);
}
write(mobilePath,h);

// Botão Excluir na tela individual do cliente.
const pagePath='public/admin-cliente.html';
let page=read(pagePath);
if(!page.includes('id="cliente-excluir"')){
  page=page.replace(
    '<button id="cliente-salvar" class="btn-primary" type="button">Salvar IA e continuar</button>',
    '<button id="cliente-salvar" class="btn-primary" type="button">Salvar IA e continuar</button><button id="cliente-excluir" class="btn-secondary" type="button" style="border-color:#ef4444;color:#ef4444">Excluir cliente</button>'
  );
  if(!page.includes('id="cliente-excluir"')){
    page=page.replace('</div>\n</div>\n\n<script src="js/config.js">','<button id="cliente-excluir" class="btn-secondary" type="button" style="border-color:#ef4444;color:#ef4444">Excluir cliente</button></div>\n</div>\n\n<script src="js/config.js">');
  }
  const hook='carregar();';
  const delJs=[
    "document.getElementById('cliente-excluir')?.addEventListener('click',async()=>{",
    " const nome=document.getElementById('cliente-titulo')?.textContent||'este cliente';",
    " if(!confirm('Excluir '+nome+'? Isso apaga a conta e os dados deste cliente.'))return;",
    " const b=document.getElementById('cliente-excluir');b.disabled=true;",
    " try{await apiFetch('/admin/clientes-gerenciados/'+encodeURIComponent(lojaId),{method:'DELETE'});location.href='admin-mobile.html#clients';}",
    " catch(e){alert(e.message||'Não foi possível excluir o cliente.');b.disabled=false;}",
    "});",
    hook
  ].join('\n');
  page=page.replace(hook,delJs);
}
write(pagePath,page);

cp.execFileSync(process.execPath,['--check',controllerPath],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','src/routes/admin.routes.js'],{stdio:'inherit'});
console.log('E-mail especial de teste e exclusão de cliente aplicados.');