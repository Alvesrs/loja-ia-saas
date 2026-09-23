const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);

write('src/controllers/adminVendas.controller.js', `
const supabase = require('../config/supabase');
const moeda = v => Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : 0;
const uuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||'')) ? String(v) : null;

async function resumo(req,res){
  try{
    const lojaId=uuid(req.query.loja_id);
    const agora=new Date(),inicioHoje=new Date(agora),inicioMes=new Date(agora.getFullYear(),agora.getMonth(),1);
    inicioHoje.setHours(0,0,0,0);
    let q=supabase.from('vendas').select('id,loja_id,subtotal,lucro_total,vendida_em').gte('vendida_em',inicioMes.toISOString()).order('vendida_em',{ascending:false});
    if(lojaId) q=q.eq('loja_id',lojaId);
    const {data,error}=await q;if(error)throw error;
    const mes=data||[],hoje=mes.filter(v=>new Date(v.vendida_em)>=inicioHoje);
    const soma=(a,k)=>moeda(a.reduce((n,x)=>n+Number(x[k]||0),0));
    let pq=supabase.from('produtos').select('id').eq('ativo',true);if(lojaId)pq=pq.eq('loja_id',lojaId);
    const {data:ps,error:pe}=await pq;if(pe)throw pe;
    let baixo=0,zerado=0;const ids=(ps||[]).map(x=>x.id);
    if(ids.length){const {data:es,error:ee}=await supabase.from('estoque').select('quantidade').in('produto_id',ids);if(ee)throw ee;baixo=(es||[]).filter(x=>Number(x.quantidade)>0&&Number(x.quantidade)<=2).length;zerado=(es||[]).filter(x=>Number(x.quantidade)<=0).length;}
    const fatMes=soma(mes,'subtotal');
    res.json({hoje:{vendas:hoje.length,faturamento:soma(hoje,'subtotal'),lucro:soma(hoje,'lucro_total')},mes:{vendas:mes.length,faturamento:fatMes,lucro:soma(mes,'lucro_total'),ticket_medio:mes.length?moeda(fatMes/mes.length):0},estoque:{baixo,zerado},recentes:mes.slice(0,5)});
  }catch(e){console.error('[vendas.resumo]',e?.message||e);res.status(500).json({erro:'Não foi possível carregar o resumo.'});}
}

async function produtos(req,res){
  try{
    const lojaId=uuid(req.query.loja_id);if(!lojaId)return res.status(400).json({erro:'Selecione uma loja.'});
    const {data:ps,error:pe}=await supabase.from('produtos').select('id,nome,preco,custo').eq('loja_id',lojaId).eq('ativo',true).order('nome');if(pe)throw pe;
    const ids=(ps||[]).map(x=>x.id);if(!ids.length)return res.json([]);
    const {data:es,error:ee}=await supabase.from('estoque').select('id,produto_id,tamanho,cor,quantidade').in('produto_id',ids);if(ee)throw ee;
    const m=new Map((ps||[]).map(p=>[p.id,p]));
    res.json((es||[]).map(e=>{const p=m.get(e.produto_id)||{};return{estoque_id:e.id,produto_id:e.produto_id,nome:p.nome||'Produto',preco:moeda(p.preco),custo:moeda(p.custo),tamanho:e.tamanho,cor:e.cor,quantidade:Number(e.quantidade||0)}}));
  }catch(e){console.error('[vendas.produtos]',e?.message||e);res.status(500).json({erro:'Não foi possível carregar os produtos.'});}
}

async function listar(req,res){
  try{
    const lojaId=uuid(req.query.loja_id);let q=supabase.from('vendas').select('id,loja_id,cliente_nome,forma_pagamento,subtotal,lucro_total,quantidade_itens,vendida_em').order('vendida_em',{ascending:false}).limit(100);if(lojaId)q=q.eq('loja_id',lojaId);
    const {data,error}=await q;if(error)throw error;res.json(data||[]);
  }catch(e){console.error('[vendas.listar]',e?.message||e);res.status(500).json({erro:'Não foi possível carregar as vendas.'});}
}

async function registrar(req,res){
  try{
    const lojaId=uuid(req.body?.loja_id),produtoId=uuid(req.body?.produto_id),estoqueId=uuid(req.body?.estoque_id);
    const quantidade=Number(req.body?.quantidade),valor=Number(req.body?.valor_unitario),custo=req.body?.custo_unitario===''||req.body?.custo_unitario==null?null:Number(req.body.custo_unitario);
    if(!lojaId||!produtoId||!estoqueId||!Number.isInteger(quantidade)||quantidade<1||!Number.isFinite(valor)||valor<0)return res.status(400).json({erro:'Dados da venda inválidos.'});
    if(custo!==null&&(!Number.isFinite(custo)||custo<0))return res.status(400).json({erro:'Custo inválido.'});
    const {data,error}=await supabase.rpc('registrar_venda_admin',{p_loja_id:lojaId,p_produto_id:produtoId,p_estoque_id:estoqueId,p_quantidade:quantidade,p_valor_unitario:valor,p_custo_unitario:custo,p_forma_pagamento:String(req.body?.forma_pagamento||'').slice(0,60)||null,p_cliente_nome:String(req.body?.cliente_nome||'').slice(0,120)||null,p_vendida_em:new Date().toISOString()});
    if(error){const m=String(error.message||'');if(m.includes('estoque_insuficiente'))return res.status(409).json({erro:'Estoque insuficiente.'});throw error;}
    res.status(201).json(data);
  }catch(e){console.error('[vendas.registrar]',e?.message||e);res.status(500).json({erro:'Não foi possível registrar a venda.'});}
}
module.exports={resumo,produtos,listar,registrar};
`);

write('src/routes/adminVendas.routes.js', `
const express=require('express');
const { exigirLogin }=require('../middleware/auth');
const { exigirAdmin }=require('../middleware/admin');
const c=require('../controllers/adminVendas.controller');
const router=express.Router();
router.use(exigirLogin);router.use(exigirAdmin);
router.get('/resumo',c.resumo);router.get('/produtos',c.produtos);router.get('/',c.listar);router.post('/',c.registrar);
module.exports=router;
`);

let app=read('src/app.js');
if(!app.includes("adminVendasRoutes")){
 app=app.replace("const adminRoutes = require('./routes/admin.routes');","const adminRoutes = require('./routes/admin.routes');\nconst adminVendasRoutes = require('./routes/adminVendas.routes');");
 app=app.replace("app.use('/api/admin', adminRoutes);","app.use('/api/admin', adminRoutes);\napp.use('/api/admin/vendas', adminVendasRoutes);");
}
write('src/app.js',app);

let h=read('public/admin-mobile.html');
h=h.replace('window.SAINTSAI_ADMIN_UI_VERSION="v4"','window.SAINTSAI_ADMIN_UI_VERSION="v5"').replaceAll('js/config.js?v=4','js/config.js?v=5').replaceAll('js/auth.js?v=4','js/auth.js?v=5').replaceAll('js/api.js?v=4','js/api.js?v=5');
h=h.replace('<nav class="nav">','<nav class="nav">\n  <button data-view="home" class="active">🏠 INÍCIO</button>');
h=h.replace('<button data-view="registro" class="active">＋ REGISTRAR NOVO CLIENTE</button>','<button data-view="vendas">💰 VENDAS</button>\n  <button data-view="registro">＋ REGISTRAR NOVO CLIENTE</button>');

const bloco=`
<section id="view-home" class="view">
 <div class="card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:end;flex-wrap:wrap"><div><h2>Visão geral</h2><p class="sub">Vendas, lucro, clientes e estoque.</p></div><select id="homeLoja"><option value="">Todas as lojas</option></select></div></div>
 <div class="metricGrid"><div class="metric"><small>Vendas hoje</small><strong id="mVendasHoje">0</strong></div><div class="metric"><small>Faturamento hoje</small><strong id="mFatHoje">R$ 0,00</strong></div><div class="metric"><small>Lucro hoje</small><strong id="mLucroHoje">R$ 0,00</strong></div><div class="metric"><small>Faturamento mês</small><strong id="mFatMes">R$ 0,00</strong></div><div class="metric"><small>Lucro mês</small><strong id="mLucroMes">R$ 0,00</strong></div><div class="metric"><small>Ticket médio</small><strong id="mTicket">R$ 0,00</strong></div></div>
 <div class="grid2"><div class="card"><h2>Clientes</h2><div class="homeLine"><span>Total</span><strong id="mClientes">0</strong></div><div class="homeLine"><span>Ativos</span><strong id="mClientesAtivos">0</strong></div></div><div class="card"><h2>Estoque</h2><div class="homeLine"><span>Baixo</span><strong id="mBaixo">0</strong></div><div class="homeLine"><span>Zerado</span><strong id="mZerado">0</strong></div></div></div>
 <div class="card"><h2>Últimas vendas</h2><div id="homeRecentes" class="salesList"><p class="sub">Nenhuma venda registrada.</p></div></div>
 <button class="btn primary" data-go="vendas">＋ Registrar venda</button>
</section>
<section id="view-vendas" class="view hidden">
 <div class="card"><h2>Registrar venda</h2><p class="sub">Baixa automaticamente o mesmo estoque do app do cliente.</p>
  <div class="field"><label>Loja / cliente</label><select id="vLoja"><option value="">Selecione a loja</option></select></div>
  <div class="field"><label>Produto / variação</label><select id="vProduto"><option value="">Selecione primeiro a loja</option></select></div>
  <div class="grid2"><div class="field"><label>Quantidade</label><input id="vQtd" type="number" min="1" value="1"></div><div class="field"><label>Valor unitário</label><input id="vValor" type="number" min="0" step="0.01"></div></div>
  <div class="grid2"><div class="field"><label>Custo unitário</label><input id="vCusto" type="number" min="0" step="0.01"></div><div class="field"><label>Pagamento</label><select id="vForma"><option>Pix</option><option>Dinheiro</option><option>Cartão de crédito</option><option>Cartão de débito</option><option>Outro</option></select></div></div>
  <div class="field"><label>Cliente da venda (opcional)</label><input id="vCliente" placeholder="Nome do comprador"></div>
  <div class="salePreview"><span>Total</span><strong id="vTotal">R$ 0,00</strong><span>Lucro estimado</span><strong id="vLucro">R$ 0,00</strong></div>
  <button id="registrarVenda" class="btn primary">Registrar venda e baixar estoque</button><div id="vStatus" class="status hidden"></div>
 </div>
 <div class="card"><h2>Histórico</h2><div id="vHistorico" class="salesList"><p class="sub">Nenhuma venda registrada.</p></div></div>
</section>
`;
h=h.replace('<main class="app">','<main class="app">'+bloco);
h=h.replace('<section id="view-registro" class="view">','<section id="view-registro" class="view hidden">');
h=h.replace('.testMark{display:inline-block;padding:5px 9px;border-radius:999px;background:rgba(34,197,94,.12);color:#4ade80;font-size:11px;font-weight:900;margin-bottom:10px}', '.testMark{display:inline-block;padding:5px 9px;border-radius:999px;background:rgba(34,197,94,.12);color:#4ade80;font-size:11px;font-weight:900;margin-bottom:10px}.metricGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:12px}.metric{background:#11111a;border:1px solid var(--line);border-radius:16px;padding:13px}.metric small{display:block;color:var(--muted);font-size:11px;margin-bottom:6px}.metric strong{font-size:18px}.homeLine{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(190,185,215,.08)}.salePreview{display:grid;grid-template-columns:1fr auto;gap:8px;margin:10px 0 14px;padding:12px;border:1px solid rgba(139,92,246,.2);border-radius:13px}.salesList{display:grid;gap:8px}.saleRow{display:flex;justify-content:space-between;gap:12px;padding:11px;border-radius:12px;background:#0d0d16;border:1px solid rgba(190,185,215,.1)}.saleRow small{display:block;color:var(--muted);margin-top:3px}.positive{color:#4ade80}');
h=h.replace("const titles={clientes:", "const titles={home:['Início','Resumo do seu negócio'],vendas:['Vendas','Registre vendas e acompanhe lucro'],clientes:");

const js=`
const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});let vendaProdutos=[];
function fillStoreSelects(){const all='<option value="">Todas as lojas</option>'+clientesCache.map(c=>'<option value="'+c.loja_id+'">'+esc(c.nome)+'</option>').join('');$('homeLoja').innerHTML=all;$('vLoja').innerHTML='<option value="">Selecione a loja</option>'+clientesCache.map(c=>'<option value="'+c.loja_id+'">'+esc(c.nome)+'</option>').join('')}
async function loadHome(){try{const id=$('homeLoja').value,q=id?'?loja_id='+encodeURIComponent(id):'',r=await apiFetch('/admin/vendas/resumo'+q);$('mVendasHoje').textContent=r.hoje.vendas;$('mFatHoje').textContent=brl(r.hoje.faturamento);$('mLucroHoje').textContent=brl(r.hoje.lucro);$('mFatMes').textContent=brl(r.mes.faturamento);$('mLucroMes').textContent=brl(r.mes.lucro);$('mTicket').textContent=brl(r.mes.ticket_medio);$('mBaixo').textContent=r.estoque.baixo;$('mZerado').textContent=r.estoque.zerado;$('mClientes').textContent=id?1:clientesCache.length;$('mClientesAtivos').textContent=id?(clientesCache.find(c=>c.loja_id===id)?.ativa?1:0):clientesCache.filter(c=>c.ativa).length;$('homeRecentes').innerHTML=(r.recentes||[]).length?r.recentes.map(v=>'<div class="saleRow"><div><strong>'+brl(v.subtotal)+'</strong><small>'+new Date(v.vendida_em).toLocaleString('pt-BR')+'</small></div><div><strong class="positive">'+brl(v.lucro_total)+'</strong><small>lucro</small></div></div>').join(''):'<p class="sub">Nenhuma venda registrada.</p>'}catch(e){console.warn(e)}}
async function loadVendaProdutos(){const id=$('vLoja').value;vendaProdutos=[];if(!id){$('vProduto').innerHTML='<option value="">Selecione primeiro a loja</option>';return}vendaProdutos=await apiFetch('/admin/vendas/produtos?loja_id='+encodeURIComponent(id));$('vProduto').innerHTML='<option value="">Selecione o produto</option>'+vendaProdutos.map((p,i)=>'<option value="'+i+'" '+(p.quantidade<=0?'disabled':'')+'>'+esc(p.nome)+' · '+esc(p.tamanho)+' · '+esc(p.cor)+' · estoque '+p.quantidade+'</option>').join('');await loadHistorico()}
function vendaPreview(){const q=Math.max(1,Number($('vQtd').value)||1),v=Number($('vValor').value)||0,c=Number($('vCusto').value)||0;$('vTotal').textContent=brl(v*q);$('vLucro').textContent=brl((v-c)*q)}
function chooseVendaProduto(){const p=vendaProdutos[Number($('vProduto').value)];if(p){$('vValor').value=p.preco;$('vCusto').value=p.custo;$('vQtd').max=p.quantidade}vendaPreview()}
async function loadHistorico(){try{const id=$('vLoja').value,xs=await apiFetch('/admin/vendas'+(id?'?loja_id='+encodeURIComponent(id):''));$('vHistorico').innerHTML=xs.length?xs.map(v=>'<div class="saleRow"><div><strong>'+brl(v.subtotal)+'</strong><small>'+new Date(v.vendida_em).toLocaleString('pt-BR')+'</small></div><div><strong class="positive">'+brl(v.lucro_total)+'</strong><small>lucro</small></div></div>').join(''):'<p class="sub">Nenhuma venda registrada.</p>'}catch(e){}}
async function registrarVenda(){const p=vendaProdutos[Number($('vProduto').value)],st=$('vStatus');st.className='status';st.classList.remove('hidden');if(!p||!$('vLoja').value){st.textContent='Selecione loja e produto.';return}const q=Number($('vQtd').value);if(q>p.quantidade){st.textContent='Estoque insuficiente. Disponível: '+p.quantidade;return}const b=$('registrarVenda');b.disabled=true;try{const r=await apiFetch('/admin/vendas',{method:'POST',body:JSON.stringify({loja_id:$('vLoja').value,produto_id:p.produto_id,estoque_id:p.estoque_id,quantidade:q,valor_unitario:Number($('vValor').value),custo_unitario:Number($('vCusto').value),forma_pagamento:$('vForma').value,cliente_nome:$('vCliente').value.trim()})});st.className='status ok';st.textContent='Venda registrada. Lucro: '+brl(r.lucro_total)+' · estoque restante: '+r.estoque_restante;$('vQtd').value=1;$('vCliente').value='';await loadVendaProdutos();await loadHome()}catch(e){st.textContent=e.message||'Não foi possível registrar.'}finally{b.disabled=false}}
`;
h=h.replace("loadClients().then(()=>{fillStoreSelects();loadHome();loadHistorico();});const initial=(location.hash||'#home').slice(1);showView(titles[initial]?initial:'home');", "loadClients().then(()=>{fillStoreSelects();loadHome();loadHistorico();});const initial=(location.hash||'#home').slice(1);showView(titles[initial]?initial:'home');");
h=h.replace("const th=$('adminTheme');", js+"\n$('homeLoja').onchange=loadHome;$('vLoja').onchange=loadVendaProdutos;$('vProduto').onchange=chooseVendaProduto;['vQtd','vValor','vCusto'].forEach(id=>$(id).oninput=vendaPreview);$('registrarVenda').onclick=registrarVenda;\nconst th=$('adminTheme');");
h=h.replace("loadClients();const initial=(location.hash||'#registro').slice(1);showView(titles[initial]?initial:'registro');", "loadClients().then(()=>{fillStoreSelects();loadHome();loadHistorico();});const initial=(location.hash||'#home').slice(1);showView(titles[initial]?initial:'home');");
write('public/admin-mobile.html',h);
write('public/admin.html','<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Cache-Control" content="no-store"><script>location.replace("admin-mobile.html?v=5#home")</script></head><body></body></html>');
console.log('Sales dashboard v1 aplicado.');
