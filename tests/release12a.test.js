const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
require('./helpers/mockSupabaseModule').instalarMockSupabaseJs();
const db = require('../src/config/supabase');
const { criarResMock } = require('./helpers/httpMocks');
const asaas = require('../src/services/asaas.service');

function banco({ falharAtualizacao = false, existente = null } = {}) {
  const eventos = new Set(); const operacoes = []; let falhar = falharAtualizacao;
  db.from = (tabela) => {
    let acao = 'select', payload, filtros = {};
    const q = {};
    for (const nome of ['select','order','limit','range','ilike']) q[nome] = (...args) => { operacoes.push({ tabela, nome, args }); return q; };
    q.eq = (k,v) => { filtros[k] = v; return q; };
    q.insert = (p) => { acao = 'insert'; payload = p; return q; };
    q.update = (p) => { acao = 'update'; payload = p; return q; };
    const executar = () => {
      operacoes.push({ tabela, acao, payload, filtros });
      if (tabela === 'cobranca_webhook_eventos') {
        if (acao === 'insert') { eventos.add(payload.evento_id); return { data: { id:'event-row' } }; }
        return { data: eventos.has(filtros.evento_id) ? { id:'event-row' } : null };
      }
      if (tabela === 'cobrancas_assinaturas') {
        if (acao === 'update' && falhar) { falhar = false; return { error: new Error('temporary') }; }
        return { data: { id:'checkout-row', loja_id:'loja-a', plano:'basico' } };
      }
      if (tabela === 'assinaturas') return { data: acao === 'select' ? existente : { id:'sub-row', ...payload } };
      return { data: [], count:0 };
    };
    q.maybeSingle = async () => executar(); q.single = async () => executar();
    q.then = (resolve,reject) => Promise.resolve(executar()).then(resolve,reject);
    return q;
  };
  return { eventos, operacoes };
}

test('12A: rejeição de rede na autenticação retorna 503 sem vazar segredo', async () => {
  db.auth.getUser = async () => { throw new Error('segredo'); };
  const res = criarResMock();
  await require('../src/middleware/auth').exigirLogin({headers:{authorization:'Bearer teste'}},res,()=>assert.fail('não autenticar'));
  assert.equal(res.statusCode,503); assert.doesNotMatch(JSON.stringify(res.body),/segredo/);
});
test('12A: usuário comum e metadata manipulada não concedem admin', () => {
  process.env.SAAS_ADMIN_EMAILS='dono@example.com';
  const { exigirAdmin } = require('../src/middleware/admin');
  const res=criarResMock();
  exigirAdmin({usuario:{email:'outro@example.com',user_metadata:{admin:true}}},res,()=>assert.fail('não autorizar'));
  assert.equal(res.statusCode,403);
});
test('12A: falha de cobrança não consome evento; retry conclui e reentrega é deduplicada', async () => {
  const b=banco({falharAtualizacao:true});
  const evento={id:'retry-12a',event:'CHECKOUT_PAID',checkout:{id:'checkout'}};
  await assert.rejects(asaas.processarEventoAsaas(evento));
  assert.equal(b.eventos.has(evento.id),false);
  assert.equal((await asaas.processarEventoAsaas(evento)).atualizado,true);
  assert.equal(b.eventos.has(evento.id),true);
  assert.equal((await asaas.processarEventoAsaas(evento)).duplicado,true);
});
test('12A: duplicatas concorrentes nesta instância aplicam o evento uma vez', async () => {
  const b=banco(); const evento={id:'concurrent-12a',event:'CHECKOUT_PAID',checkout:{id:'checkout'}};
  const resultados=await Promise.all([asaas.processarEventoAsaas(evento),asaas.processarEventoAsaas(evento)]);
  assert.equal(resultados.filter(x=>x.duplicado).length,1);
  assert.equal(b.operacoes.filter(x=>x.tabela==='assinaturas'&&x.acao==='insert').length,1);
});
test('12A: evento sem identificação é rejeitado', async () => {
  banco(); await assert.rejects(asaas.processarEventoAsaas({event:'CHECKOUT_PAID'}),/evento_invalido/);
});
test('12A: pagamento vencido de assinatura antiga não bloqueia a nova', async () => {
  const b=banco({existente:{id:'atual',provider_assinatura_id:'nova',provedor_pagamento:'asaas'}});
  await asaas.processarEventoAsaas({id:'old-12a',event:'PAYMENT_OVERDUE',payment:{subscription:'antiga'}});
  assert.equal(b.operacoes.filter(x=>x.tabela==='assinaturas'&&x.acao==='update').length,0);
});
test('12A: edição manual preserva vínculo financeiro existente', async () => {
  const b=banco({existente:{id:'atual',provider_assinatura_id:'sub',provedor_pagamento:'asaas'}});
  await require('../src/services/assinaturas.service').definirAssinatura('loja-a',{plano:'basico',status:'ativo',valido_ate:null});
  const op=b.operacoes.find(x=>x.tabela==='assinaturas'&&x.acao==='update');
  assert.equal(Object.hasOwn(op.payload,'provider_assinatura_id'),false);
  assert.equal(Object.hasOwn(op.payload,'provedor_pagamento'),false);
  assert.equal(op.filtros.loja_id,'loja-a');
});
test('12A: lista administrativa usa paginação limitada', async () => {
  const b=banco();const res=criarResMock();
  await require('../src/controllers/admin.controller').listarEmpresas({query:{pagina:'2'}},res);
  assert.equal(res.statusCode,200);
  assert.deepEqual(b.operacoes.find(x=>x.nome==='range').args,[20,39]);
});
test('12A: paginação inválida não consulta o banco', async () => {
  const b=banco();const res=criarResMock();
  await require('../src/controllers/admin.controller').listarEmpresas({query:{pagina:'-1'}},res);
  assert.equal(res.statusCode,400);assert.equal(b.operacoes.length,0);
});
test('12A: confirmação escapa texto e aspas', () => {
  const c=vm.createContext({});vm.runInContext(fs.readFileSync('public/js/components.js','utf8'),c);
  assert.equal(c.escaparTexto('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('12A: login de outra conta elimina seleção e cache da conta anterior', () => {
  const criar=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
  const localStorage=criar(),sessionStorage=criar();const c=vm.createContext({localStorage,sessionStorage,document:{addEventListener(){}},window:{addEventListener(){}}});
  vm.runInContext(fs.readFileSync('public/js/auth.js','utf8'),c);
  localStorage.setItem('lojaia_loja_atual_id','antiga');sessionStorage.setItem('lojaia_loja_atual','dados');
  c.salvarSessao({id:'novo'},'token');
  assert.equal(localStorage.getItem('lojaia_loja_atual_id'),null);assert.equal(sessionStorage.getItem('lojaia_loja_atual'),null);
  assert.equal(c.obterUsuario().id,'novo');
});
test('12A: navegação móvel inclui plano e admin apenas para administrador', () => {
  const c=vm.createContext({navigator:{},window:{addEventListener(){}}});vm.runInContext(fs.readFileSync('public/js/layout.js','utf8'),c);
  assert.match(c.montarSidebar('plano'),/plano.html/);assert.match(c.montarSidebar('ajuda'),/ajuda.html/);assert.match(c.montarTabbar('plano'),/dashboard.html/);
  assert.doesNotMatch(c.montarTabbar('plano'),/admin.html/);assert.match(c.montarTabbar('admin',true),/admin.html/);
});
