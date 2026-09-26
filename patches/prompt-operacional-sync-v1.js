const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

let c=read('src/controllers/clienteHub.controller.js');

const ini=c.indexOf('function separarPromptCliente(prompt){');
const fim=c.indexOf('\nasync function obterConfiguracaoIa',ini);
if(ini<0||fim<0)throw new Error('separarPromptCliente não encontrado');
const novaFunc=[
"function removerBlocoPrompt(texto,inicio,fim){",
"  const s=String(texto||'');const a=s.indexOf(inicio);if(a<0)return {texto:s,bloco:''};",
"  const b=s.indexOf(fim,a+inicio.length);if(b<0)return {texto:s,bloco:''};",
"  const end=b+fim.length;return {texto:(s.slice(0,a)+String.fromCharCode(10)+s.slice(end)).trim(),bloco:s.slice(a,end)};",
"}",
"function separarPromptCliente(prompt){",
"  let texto=String(prompt||'');",
"  const cfg=removerBlocoPrompt(texto,'[SAINTSAI_CONFIG_CLIENTE]','[/SAINTSAI_CONFIG_CLIENTE]');texto=cfg.texto;",
"  const op=removerBlocoPrompt(texto,'[SAINTSAI_DADOS_NEGOCIO]','[/SAINTSAI_DADOS_NEGOCIO]');texto=op.texto;",
"  return {base:texto.trim(),gerenciado:cfg.bloco,operacional:op.bloco};",
"}"
].join('\n');
c=c.slice(0,ini)+novaFunc+c.slice(fim);

c=c.split(".eq('id',loja.id).eq('dono_id',req.usuario.id).maybeSingle()").join(".eq('id',loja.id).maybeSingle()");
c=c.split(".eq('id',loja.id).eq('dono_id',req.usuario.id);").join(".eq('id',loja.id);");

const oldSave="const gerenciado=separarPromptCliente(atual?.prompt_mestre).gerenciado;\n    const final=[prompt,gerenciado].filter(Boolean).join(String.fromCharCode(10,10));";
if(!c.includes(oldSave))throw new Error('Salvamento IA não encontrado');
c=c.replace(oldSave,
"const partes=separarPromptCliente(atual?.prompt_mestre);\n    const final=[prompt,partes.gerenciado,partes.operacional].filter(Boolean).join(String.fromCharCode(10,10));"
);

const oldReturn="if(error)throw error;\n    return res.json({ok:true,prompt});";
if(!c.includes(oldReturn))throw new Error('Retorno salvar IA não encontrado');
c=c.replace(oldReturn,
"if(error)throw error;\n    await supabase.rpc('saintsai_sync_prompt_operacional',{p_loja_id:loja.id});\n    return res.json({ok:true,prompt});"
);

if(!c.includes('async function sincronizarConfiguracaoIa')){
  const anchor='async function salvarConfiguracaoIa(req,res){';
  const p=c.indexOf(anchor);
  if(p<0)throw new Error('Função salvarConfiguracaoIa não encontrada');
  const after=c.indexOf('\n}\n',p);
  if(after<0)throw new Error('Fim salvarConfiguracaoIa não encontrado');
  const pos=after+3;
  const fn=[
    "async function sincronizarConfiguracaoIa(req,res){",
    "  try{",
    "    const loja=await exigirLoja(req,res);if(!loja)return;",
    "    const {error}=await supabase.rpc('saintsai_sync_prompt_operacional',{p_loja_id:loja.id});",
    "    if(error)throw error;",
    "    const {data,error:e2}=await supabase.from('lojas').select('prompt_mestre').eq('id',loja.id).maybeSingle();",
    "    if(e2)throw e2;",
    "    const partes=separarPromptCliente(data?.prompt_mestre);",
    "    return res.json({ok:true,prompt:partes.base,sincronizado:true});",
    "  }catch(e){console.error('[cliente-hub] sync prompt',e?.message||e);return res.status(500).json({erro:'Não foi possível atualizar os dados automáticos da IA.'});}",
    "}",
    ""
  ].join('\n');
  c=c.slice(0,pos)+fn+c.slice(pos);
}
c=c.replace(/module\.exports=\{([^}]*)\}/,(m,inside)=>{
  if(inside.includes('sincronizarConfiguracaoIa'))return m;
  return 'module.exports={'+inside.trim().replace(/,$/,'')+',sincronizarConfiguracaoIa}';
});
write('src/controllers/clienteHub.controller.js',c);

let r=read('src/routes/clienteHub.routes.js');
if(!r.includes("'/config-ia/sincronizar'")){
  const anchor="r.put('/config-ia',c.salvarConfiguracaoIa);";
  if(!r.includes(anchor))throw new Error('Rota config IA não encontrada');
  r=r.replace(anchor,anchor+"\nr.post('/config-ia/sincronizar',c.sincronizarConfiguracaoIa);");
}
write('src/routes/clienteHub.routes.js',r);

let h=read('public/cliente-configuracao.html');
if(!h.includes('id="ia-sync"')){
  h=h.replace(
    '<button class="btn secondary" id="ia-melhorar">✨ Aprimorar com IA</button><button class="btn" id="ia-save">Salvar IA</button>',
    '<button class="btn secondary" id="ia-melhorar">✨ Aprimorar com IA</button><button class="btn secondary" id="ia-sync">↻ Atualizar dados da loja</button><button class="btn" id="ia-save">Salvar IA</button>'
  );
  h=h.replace(
    '<div class="status" id="ia-status"></div>',
    '<div class="notice">Itens/serviços, agenda e pagamentos entram automaticamente no contexto da IA sem apagar suas instruções.</div><div class="status" id="ia-status"></div>'
  );
  const anchor="$('ia-save').onclick=async()=>";
  const i=h.indexOf(anchor);
  if(i<0)throw new Error('Handler salvar IA não encontrado');
  const handler="$('ia-sync').onclick=async()=>{const st=$('ia-status'),b=$('ia-sync');try{b.disabled=true;st.textContent='Atualizando dados da loja…';const x=await apiFetch('/lojas/'+loja.id+'/cliente-hub/config-ia/sincronizar',{method:'POST',body:'{}'});if(x.prompt!==undefined)$('ia-prompt').value=x.prompt;st.textContent='Dados automáticos atualizados no Prompt Mestre.';}catch(e){st.textContent=e.message||'Não foi possível atualizar.';}finally{b.disabled=false;}};\n ";
  h=h.slice(0,i)+handler+h.slice(i);
}
write('public/cliente-configuracao.html',h);

cp.execFileSync(process.execPath,['--check','src/controllers/clienteHub.controller.js'],{stdio:'inherit'});
console.log('Prompt Mestre operacional sincronizado sem apagar instruções do cliente.');