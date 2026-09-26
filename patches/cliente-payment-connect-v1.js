const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

let c=read('src/controllers/clienteHub.controller.js');
if(!c.includes('async function conectarPagamento')){
  c=c.replace(
    "async function criarAgendamento(req,res){",
`function asaasBase(ambiente){return ambiente==='sandbox'?'https://api-sandbox.asaas.com/v3':'https://api.asaas.com/v3';}

async function asaasGet(chave,ambiente,caminho){
  const r=await fetch(asaasBase(ambiente)+caminho,{headers:{accept:'application/json','access_token':chave,'User-Agent':'SaintsAI/1.0'}});
  const texto=await r.text();
  let body={};try{body=texto?JSON.parse(texto):{};}catch(_){}
  if(!r.ok){const e=new Error('asaas_http_'+r.status);e.status=r.status;e.body=body;throw e;}
  return body;
}

async function conectarPagamento(req,res){
  let novoSecretId=null;
  try{
    const loja=await exigirLoja(req,res);if(!loja)return;
    const provedor=String(req.body?.provedor||'').trim().toLowerCase();
    const chave=String(req.body?.chave_api||'').trim();
    if(provedor!=='asaas')return res.status(400).json({erro:'Neste momento a conexão automática disponível é Asaas.'});
    if(!chave||chave.length<20)return res.status(400).json({erro:'Informe uma chave de API válida.'});
    const ambiente=chave.startsWith('$aact_hmlg_')?'sandbox':(chave.startsWith('$aact_prod_')?'producao':String(req.body?.ambiente||'producao'));
    let status;
    try{status=await asaasGet(chave,ambiente,'/myAccount/status/');}
    catch(e){
      if(e.status===401)return res.status(400).json({erro:'A chave do Asaas foi recusada. Confira a chave e o ambiente.'});
      throw e;
    }

    const {data:atual,error:ea}=await supabase.from('saintsai_pagamento_config').select('provedor_secret_id').eq('loja_id',loja.id).maybeSingle();
    if(ea)throw ea;

    const {data:secretId,error:es}=await supabase.rpc('saintsai_store_payment_secret',{p_loja_id:loja.id,p_secret:chave});
    if(es)throw es;
    novoSecretId=secretId;

    const resumo='Asaas · '+ambiente+(status?.general?' · '+status.general:'');
    const payload={loja_id:loja.id,provedor:'asaas',conectado:true,provedor_secret_id:secretId,provedor_ambiente:ambiente,provedor_status:String(status?.general||'CONECTADO'),provedor_conta_resumo:resumo,aceita_pix_online:true,atualizado_em:new Date().toISOString()};
    const {data,error}=await supabase.from('saintsai_pagamento_config').upsert(payload,{onConflict:'loja_id'}).select('loja_id,provedor,conectado,provedor_ambiente,provedor_status,provedor_conta_resumo,aceita_pix_online,aceita_pix_presencial,aceita_dinheiro,aceita_cartao_presencial,exige_pagamento_antecipado,sinal_tipo,sinal_valor').single();
    if(error)throw error;

    if(atual?.provedor_secret_id && atual.provedor_secret_id!==secretId){
      await supabase.rpc('saintsai_delete_payment_secret',{p_secret_id:atual.provedor_secret_id});
    }
    return res.json(data);
  }catch(e){
    if(novoSecretId)try{await supabase.rpc('saintsai_delete_payment_secret',{p_secret_id:novoSecretId});}catch(_){}
    console.error('[cliente-hub] conectar pagamento',e?.message||e);
    return res.status(500).json({erro:'Não foi possível conectar a conta de pagamento.'});
  }
}

async function desconectarPagamento(req,res){
  try{
    const loja=await exigirLoja(req,res);if(!loja)return;
    const {data:cfg,error}=await supabase.from('saintsai_pagamento_config').select('provedor_secret_id').eq('loja_id',loja.id).maybeSingle();
    if(error)throw error;
    if(cfg?.provedor_secret_id)await supabase.rpc('saintsai_delete_payment_secret',{p_secret_id:cfg.provedor_secret_id});
    const {data,error:eu}=await supabase.from('saintsai_pagamento_config').upsert({loja_id:loja.id,provedor:null,conectado:false,provedor_secret_id:null,provedor_ambiente:null,provedor_status:null,provedor_conta_resumo:null,aceita_pix_online:false,atualizado_em:new Date().toISOString()},{onConflict:'loja_id'}).select('loja_id,provedor,conectado,provedor_ambiente,provedor_status,provedor_conta_resumo,aceita_pix_online,aceita_pix_presencial,aceita_dinheiro,aceita_cartao_presencial,exige_pagamento_antecipado,sinal_tipo,sinal_valor').single();
    if(eu)throw eu;return res.json(data);
  }catch(e){return res.status(500).json({erro:'Não foi possível desconectar a conta de pagamento.'});}
}

async function criarAgendamento(req,res){`
  );
  c=c.replace(
    "module.exports={resumo,criarServico,atualizarServico,excluirServico,salvarPagamentos,criarAgendamento,atualizarAgendamento};",
    "module.exports={resumo,criarServico,atualizarServico,excluirServico,salvarPagamentos,conectarPagamento,desconectarPagamento,criarAgendamento,atualizarAgendamento};"
  );
}
write('src/controllers/clienteHub.controller.js',c);

let r=read('src/routes/clienteHub.routes.js');
if(!r.includes("pagamentos/conectar")){
  r=r.replace("r.put('/pagamentos',c.salvarPagamentos);",
    "r.put('/pagamentos',c.salvarPagamentos);\nr.post('/pagamentos/conectar',c.conectarPagamento);\nr.post('/pagamentos/desconectar',c.desconectarPagamento);");
}
write('src/routes/clienteHub.routes.js',r);

let h=read('public/cliente-central.html');
h=h.replace(
  '<div class="row" style="margin-top:14px"><button class="btn" id="p-save">Salvar formas</button><button class="btn2" id="p-connect">Conectar pagamento automático</button></div><div id="p-status" class="muted" style="margin-top:8px"></div><div class="notice">A conexão automática será feita com autorização segura do provedor. Nenhuma chave secreta será salva no aplicativo.</div>',
  '<div id="p-conexao" class="notice" style="margin-top:14px">Pagamento automático não conectado.</div><div class="field"><label>Chave API do Asaas</label><input id="p-chave" type="password" autocomplete="off" placeholder="Cole a chave criada no Asaas"><small class="muted">A chave é enviada ao backend e guardada criptografada. Ela não fica salva no aplicativo.</small></div><div class="row" style="margin-top:14px"><button class="btn" id="p-save">Salvar formas</button><button class="btn2" id="p-connect">Conectar Asaas</button><button class="btn2" id="p-disconnect">Desconectar</button></div><div id="p-status" class="muted" style="margin-top:8px"></div>'
);
h=h.replace(
  "function renderPag(){const p=dados.pagamentos||{};$('p-din').checked=!!p.aceita_dinheiro;$('p-pixp').checked=!!p.aceita_pix_presencial;$('p-cart').checked=!!p.aceita_cartao_presencial;$('p-pixo').checked=!!p.aceita_pix_online;$('p-prov').value=p.provedor||'';$('p-antec').checked=!!p.exige_pagamento_antecipado;$('p-sinal-t').value=p.sinal_tipo||'nenhum';$('p-sinal-v').value=Number(p.sinal_valor||0);}",
  "function renderPag(){const p=dados.pagamentos||{};$('p-din').checked=!!p.aceita_dinheiro;$('p-pixp').checked=!!p.aceita_pix_presencial;$('p-cart').checked=!!p.aceita_cartao_presencial;$('p-pixo').checked=!!p.aceita_pix_online;$('p-prov').value=p.provedor||'';$('p-antec').checked=!!p.exige_pagamento_antecipado;$('p-sinal-t').value=p.sinal_tipo||'nenhum';$('p-sinal-v').value=Number(p.sinal_valor||0);$('p-conexao').textContent=p.conectado?(p.provedor_conta_resumo||'Pagamento automático conectado.'):'Pagamento automático não conectado.';$('p-disconnect').style.display=p.conectado?'inline-flex':'none';}"
);
h=h.replace(
  "$('p-connect').onclick=()=>{$('p-status').textContent='Escolha o provedor e salve. A autorização segura da conta será ativada na próxima etapa da integração.';};",
  "$('p-connect').onclick=async()=>{try{const chave=$('p-chave').value.trim();if(!chave){$('p-status').textContent='Cole a chave API criada no Asaas.';return;}$('p-connect').disabled=true;$('p-status').textContent='Validando diretamente no Asaas…';const p=await apiFetch('/lojas/'+loja.id+'/cliente-hub/pagamentos/conectar',{method:'POST',body:JSON.stringify({provedor:'asaas',chave_api:chave})});dados.pagamentos={...(dados.pagamentos||{}),...p};$('p-chave').value='';renderPag();$('p-status').textContent='Conta Asaas conectada com segurança.';}catch(e){$('p-status').textContent=e.message||'Não foi possível conectar.';}finally{$('p-connect').disabled=false;}};\n$('p-disconnect').onclick=async()=>{try{$('p-status').textContent='Desconectando…';const p=await apiFetch('/lojas/'+loja.id+'/cliente-hub/pagamentos/desconectar',{method:'POST',body:'{}'});dados.pagamentos={...(dados.pagamentos||{}),...p};renderPag();$('p-status').textContent='Pagamento automático desconectado.';}catch(e){$('p-status').textContent=e.message||'Não foi possível desconectar.';}};"
);
write('public/cliente-central.html',h);

console.log('Conexão segura Asaas por empresa via Supabase Vault aplicada.');
