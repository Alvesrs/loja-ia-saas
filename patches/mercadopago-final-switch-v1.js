const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const os=require('node:os');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

/* Expõe status do Mercado Pago usando o OAuth que já existe no projeto. */
let c=read('src/controllers/mercadoPagoOAuth.controller.js');
if(!c.includes('async function status(req,res)')){
  const marker='module.exports={iniciar,callback};';
  if(!c.includes(marker))throw new Error('Export Mercado Pago OAuth não encontrado');
  const fn=[
    "async function status(req,res){",
    "  try{",
    "    const lojaId=String(req.params.lojaId||'');",
    "    const {data:loja,error:el}=await supabase.from('lojas').select('id,dono_id').eq('id',lojaId).eq('dono_id',req.usuario.id).maybeSingle();",
    "    if(el)throw el;if(!loja)return res.status(404).json({erro:'Loja não encontrada.'});",
    "    const {data:pc,error}=await supabase.from('saintsai_pagamento_config').select('provedor,conectado,provedor_ambiente,provedor_status,provedor_conta_resumo').eq('loja_id',lojaId).maybeSingle();",
    "    if(error)throw error;",
    "    const configurado=Boolean(String(process.env.MP_CLIENT_ID||'').trim()&&String(process.env.MP_CLIENT_SECRET||'').trim()&&String(process.env.MP_REDIRECT_URI||'').trim());",
    "    return res.json({plataforma:{configurado,faltantes:[!process.env.MP_CLIENT_ID?'MP_CLIENT_ID':null,!process.env.MP_CLIENT_SECRET?'MP_CLIENT_SECRET':null,!process.env.MP_REDIRECT_URI?'MP_REDIRECT_URI':null].filter(Boolean)},conectado:Boolean(pc?.provedor==='mercadopago'&&pc?.conectado===true),ambiente:pc?.provedor==='mercadopago'?(pc?.provedor_ambiente||null):null,status:pc?.provedor==='mercadopago'?(pc?.provedor_status||null):null,conta:pc?.provedor==='mercadopago'?(pc?.provedor_conta_resumo||null):null});",
    "  }catch(e){console.error('[mp-oauth] status',e?.message||e);return res.status(500).json({erro:'Não foi possível consultar o Mercado Pago.'});}",
    "}",
    ""
  ].join('\n');
  c=c.replace(marker,fn+'module.exports={iniciar,callback,status};');
}
write('src/controllers/mercadoPagoOAuth.controller.js',c);

let r=read('src/routes/mercadoPagoOAuth.routes.js');
if(!r.includes("'/lojas/:lojaId/status'")){
  const a="r.post('/lojas/:lojaId/iniciar',exigirLogin,c.iniciar);";
  if(!r.includes(a))throw new Error('Rota iniciar Mercado Pago não encontrada');
  r=r.replace(a,"r.get('/lojas/:lojaId/status',exigirLogin,c.status);\n"+a);
}
write('src/routes/mercadoPagoOAuth.routes.js',r);

/* Troca a etapa visual final de PagBank para Mercado Pago. */
let h=read('public/cliente-configuracao.html');
const p0=h.indexOf('function renderPagamentos(){');
const p1=h.indexOf('\nfunction renderAgenda(){',p0);
if(p0<0||p1<0)throw new Error('renderPagamentos não encontrado');
const render=[
"function renderPagamentos(){",
" const p=resumo.pagamentos||{};",
" $('content').innerHTML='<h2>Mercado Pago e formas de pagamento</h2><p class=\"muted\">Conecte a conta Mercado Pago da empresa. Cada estabelecimento recebe diretamente na própria conta.</p><div class=\"notice\" id=\"mp-health\">Verificando Mercado Pago…</div><div class=\"checks\"><label class=\"check\"><input id=\"p-din\" type=\"checkbox\"> Dinheiro</label><label class=\"check\"><input id=\"p-pixp\" type=\"checkbox\"> Pix presencial</label><label class=\"check\"><input id=\"p-cart\" type=\"checkbox\"> Cartão presencial</label><label class=\"check\"><input id=\"p-pixo\" type=\"checkbox\"> Pix online / automático</label><label class=\"check\"><input id=\"p-antec\" type=\"checkbox\"> Exigir pagamento antecipado</label></div><div class=\"row\"><div class=\"field\"><label>Sinal</label><select id=\"p-sinal-t\"><option value=\"nenhum\">Sem sinal</option><option value=\"fixo\">Valor fixo</option><option value=\"percentual\">Percentual</option></select></div><div class=\"field\"><label>Valor do sinal</label><input id=\"p-sinal-v\" type=\"number\" min=\"0\" step=\".01\"></div></div><div class=\"btns\"><button class=\"btn\" id=\"p-save\">Salvar formas</button><button class=\"btn secondary\" id=\"p-mp\">Conectar Mercado Pago</button></div><div class=\"status\" id=\"p-status\"></div>';",
" $('p-din').checked=!!p.aceita_dinheiro;$('p-pixp').checked=!!p.aceita_pix_presencial;$('p-cart').checked=!!p.aceita_cartao_presencial;$('p-pixo').checked=!!p.aceita_pix_online;$('p-antec').checked=!!p.exige_pagamento_antecipado;$('p-sinal-t').value=p.sinal_tipo||'nenhum';$('p-sinal-v').value=Number(p.sinal_valor||0);",
" const q=new URLSearchParams(location.search).get('mp');if(q==='conectado')$('p-status').textContent='Mercado Pago conectado com sucesso.';else if(q==='erro')$('p-status').textContent='A autorização do Mercado Pago não foi concluída.';",
" (async()=>{try{const st=await apiFetch('/pagamentos/mercadopago/lojas/'+loja.id+'/status');const health=$('mp-health'),btn=$('p-mp');if(!st.plataforma?.configurado){health.textContent='Mercado Pago aguardando as credenciais da aplicação SaintsAI.';btn.disabled=true;btn.textContent='Aguardando ativação';}else if(st.conectado){health.textContent='Mercado Pago conectado'+(st.ambiente?' · '+st.ambiente:'');btn.textContent='Reconectar Mercado Pago';}else{health.textContent='Mercado Pago disponível para conexão.';btn.textContent='Conectar Mercado Pago';}}catch(e){$('mp-health').textContent='Não foi possível verificar o Mercado Pago agora.';}})();",
" $('p-save').onclick=async()=>{const st=$('p-status');try{st.textContent='Salvando…';const np=await apiFetch('/lojas/'+loja.id+'/cliente-hub/pagamentos',{method:'PUT',body:JSON.stringify({provedor:p.provedor||null,aceita_dinheiro:$('p-din').checked,aceita_pix_presencial:$('p-pixp').checked,aceita_cartao_presencial:$('p-cart').checked,aceita_pix_online:$('p-pixo').checked,exige_pagamento_antecipado:$('p-antec').checked,sinal_tipo:$('p-sinal-t').value,sinal_valor:Number($('p-sinal-v').value||0)})});resumo.pagamentos={...p,...np};st.textContent='Formas de pagamento salvas.';await recarregarProgresso();}catch(e){st.textContent=e.message||'Não foi possível salvar.';}};",
" $('p-mp').onclick=async()=>{const st=$('p-status'),b=$('p-mp');try{b.disabled=true;st.textContent='Abrindo autorização segura do Mercado Pago…';const x=await apiFetch('/pagamentos/mercadopago/lojas/'+loja.id+'/iniciar',{method:'POST',body:'{}'});if(!x.url)throw new Error('URL de autorização não recebida.');location.href=x.url;}catch(e){st.textContent=e.message||'Não foi possível iniciar a conexão.';b.disabled=false;}};",
"}"
].join('\n');
h=h.slice(0,p0)+render+h.slice(p1);
write('public/cliente-configuracao.html',h);

let hub=read('src/controllers/clienteHub.controller.js');
hub=hub.replace("id:'pagbank',titulo:'Conecte o PagBank',descricao:'Conecte sua conta PagBank para receber pagamentos online.'","id:'mercadopago',titulo:'Conecte o Mercado Pago',descricao:'Conecte sua conta Mercado Pago para receber pagamentos online.'");
write('src/controllers/clienteHub.controller.js',hub);

/* Segurança: enquanto a criação de Pix Mercado Pago não estiver ativada no backend, não oferece Pix online. */
let booking=read('src/services/bookingPublic.service.js');
booking=booking.replace("const online=Boolean(c.conectado&&c.provedor==='pagbank'&&c.aceita_pix_online);","const online=false; // MP_PIX_V2_PENDING");
write('src/services/bookingPublic.service.js',booking);

for(const p of ['src/controllers/mercadoPagoOAuth.controller.js','src/routes/mercadoPagoOAuth.routes.js','src/controllers/clienteHub.controller.js','src/services/bookingPublic.service.js'])cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
const re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;let m,n=0;
while((m=re.exec(h))){const code=m[1].trim();if(!code)continue;const tmp=path.join(os.tmpdir(),'saintsai-mp-final-'+(++n)+'.js');fs.writeFileSync(tmp,code);try{cp.execFileSync(process.execPath,['--check',tmp],{stdio:'inherit'});}finally{try{fs.unlinkSync(tmp)}catch(_){}}}
if(!h.includes('Mercado Pago e formas de pagamento'))throw new Error('Tela final não migrou para Mercado Pago');
console.log('Mercado Pago final switch: UI e OAuth ativados; Pix online mantido bloqueado até backend MP v2.');