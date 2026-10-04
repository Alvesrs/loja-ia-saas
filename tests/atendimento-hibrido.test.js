const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/mockSupabaseModule').instalarMockSupabaseJs();
const supabase = require('../src/config/supabase');
const { criarSupabaseFake } = require('./helpers/supabaseFake');
const h = require('../src/services/atendimentoHibrido.service');
const historico = require('../src/services/whatsappHistorico.service');
const { criarPedidoDeEnvio } = require('../src/services/providers/whatsapp/contrato');
const { criarAdaptadorWaha } = require('../src/services/providers/whatsapp/adaptadorWaha');
const { criarAdaptadorMeta } = require('../src/services/providers/whatsapp/adaptadorMeta');
const LOJA = '11111111-1111-4111-8111-111111111111';
const CFG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONVERSA = '99999999-9999-4999-8999-999999999999';
process.env.SUPABASE_URL = 'https://example.supabase.co';
const URL_FOTO = process.env.SUPABASE_URL + '/storage/v1/object/public/produto-imagens/' + LOJA + '/abc.jpg';
const itens = [{ nome: 'Camisa social', preco: 80, imagem_url: URL_FOTO }, { nome: 'Barba', preco: 30 }];

test('foto explícita usa o item citado, sem escolher pela ordem do catálogo', () => {
  assert.equal(h.selecionarFoto('Manda foto da camisa social', [], itens).item.nome, 'Camisa social');
});
test('pedido genérico retoma a última referência do cliente', () => {
  const r = h.selecionarFoto('Manda a foto dela', [{ role: 'user', content: 'Quero camisa social' }, { role: 'assistant', content: 'Também temos Barba' }], itens);
  assert.equal(r.item.nome, 'Camisa social');
});
test('foto ambígua pede esclarecimento; produto inexistente não reutiliza uma foto anterior', () => {
  assert.ok(h.selecionarFoto('Foto da camisa social e barba', [], itens).resposta);
  assert.ok(h.selecionarFoto('Foto do vestido', [{ role: 'user', content: 'Camisa social' }], itens).resposta);
});
test('ver horários e negar fotos continuam no atendimento normal', () => {
  assert.equal(h.selecionarFoto('Quero ver horários', [], itens), null);
  assert.equal(h.selecionarFoto('Não manda foto da camisa social', [], itens), null);
});
test('foto externa, de outra loja, privada ou com credenciais nunca é enviada', () => {
  assert.equal(h.imagemSegura(URL_FOTO, LOJA), true);
  for (const url of ['http://127.0.0.1/image.jpg', 'https://evil.com/a.jpg', URL_FOTO.replace(LOJA, CFG), URL_FOTO + '?token=secret', URL_FOTO.replace('public/', 'authenticated/')]) {
    assert.equal(h.imagemSegura(url, LOJA), false);
  }
});
test('consulta de fotos filtra produtos e serviços pela loja e por ativo', async () => {
  const fake = criarSupabaseFake({ from: { produtos: { data: [itens[0]], error: null }, saintsai_servicos: { data: [], error: null } } });
  supabase.from = fake.from;
  const foto = await h.tentarFoto(LOJA, 'Foto da camisa social', []);
  assert.equal(foto.imagemUrl, URL_FOTO);
  for (const c of fake.chamadasFrom) { assert.equal(c.filtros.loja_id, LOJA); assert.equal(c.filtros.ativo, true); }
});
test('sem foto cadastrada não inventa mídia', async () => {
  const fake = criarSupabaseFake({ from: { produtos: { data: [], error: null }, saintsai_servicos: { data: [itens[1]], error: null } } });
  supabase.from = fake.from;
  const foto = await h.tentarFoto(LOJA, 'Foto da barba', []);
  assert.equal(foto.imagemUrl, undefined);
  assert.match(foto.resposta, /não há uma foto/);
});
test('contexto híbrido inclui preço/duração real; exclui serviços desativados', () => {
  const txt = h.contextoServicos([{ nome: 'Corte', preco: 30, duracao_min: 40 }, { nome: 'Segredo', preco: 900, ativo: false }]);
  assert.match(txt, /Corte/); assert.match(txt, /30,00/); assert.match(txt, /40 minutos/);
  assert.doesNotMatch(txt, /Segredo/); assert.match(txt, /confirmados pelo sistema/);
});
test('histórico consulta o contato exato e recebe mensagens recentes em ordem cronológica', async () => {
  const fake = criarSupabaseFake({ from: {
    whatsapp_conversas: ctx => { assert.equal(ctx.filtros.contato, '5511999999999'); assert.equal(ctx.filtros.configuracao_id, CFG); return { data: { id: CONVERSA }, error: null }; },
    whatsapp_mensagens: ctx => { assert.equal(ctx.filtros.loja_id, LOJA); assert.equal(ctx.filtros.conversa_id, CONVERSA); assert.equal(ctx.limite, 30); return { data: [{ direcao: 'entrada', texto: 'Quero M' }, { direcao: 'saida', texto: 'Qual tamanho?' }], error: null }; }
  } });
  supabase.from = fake.from;
  assert.deepEqual(await historico.obterHistoricoRecente(LOJA, CFG, '5511999999999'), [{ role: 'assistant', content: 'Qual tamanho?' }, { role: 'user', content: 'Quero M' }]);
});
test('conversa com 45 mensagens mantém as últimas 30, e não as primeiras', async () => {
  const rows = Array.from({ length: 45 }, (_, i) => ({ id: String(i).padStart(3, '0'), direcao: 'entrada', texto: 'Mensagem ' + i, criado_em: new Date(1700000000000 + i * 1000).toISOString() }));
  supabase.from = tabela => {
    const filtros = {}, ordens = []; let limite = 100;
    const q = {
      select() { return q; }, eq(k, v) { filtros[k] = v; return q; },
      order(k, v) { ordens.push([k, v.ascending]); return q; }, limit(n) { limite = n; return q; },
      async maybeSingle() { assert.equal(filtros.loja_id, LOJA); assert.equal(filtros.configuracao_id, CFG); return { data: { id: CONVERSA }, error: null }; },
      then(resolve) {
        assert.equal(tabela, 'whatsapp_mensagens'); assert.equal(filtros.loja_id, LOJA); assert.equal(filtros.conversa_id, CONVERSA);
        const sorted = [...rows].sort((a, b) => { for (const [k, ascending] of ordens) { const diff = a[k].localeCompare(b[k]); if (diff) return ascending ? diff : -diff; } return 0; });
        return Promise.resolve({ data: sorted.slice(0, limite), error: null }).then(resolve);
      }
    };
    return q;
  };
  const memoria = await historico.obterHistoricoRecente(LOJA, CFG, '5511999999999');
  assert.equal(memoria.length, 30); assert.equal(memoria[0].content, 'Mensagem 15'); assert.equal(memoria[29].content, 'Mensagem 44');
});
test('contrato rejeita mídia inválida e preserva o formato de texto sem campo extra', () => {
  const entrada = { lojaId: LOJA, configuracaoId: CFG, contato: '5511999999999', texto: 'Camisa' };
  assert.equal('imagemUrl' in criarPedidoDeEnvio(entrada), false);
  assert.equal(criarPedidoDeEnvio({ ...entrada, imagemUrl: URL_FOTO }).imagemUrl, URL_FOTO);
  assert.throws(() => criarPedidoDeEnvio({ ...entrada, imagemUrl: 'http://localhost/a.jpg' }));
});
test('WAHA envia uma imagem com legenda em uma requisição, mantendo texto comum', async () => {
  const chamadas = [];
  const p = criarAdaptadorWaha({ baseUrl: 'https://waha.example', apiKey: 'fake-test-key', session: 'empresa', fetchFn: async (url, opts) => {
    chamadas.push({ url, body: JSON.parse(opts.body) }); return { ok: true, json: async () => ({ id: 'msg1' }) };
  } });
  const entrada = { lojaId: LOJA, configuracaoId: CFG, contato: '5511999999999', texto: 'Camisa · R$ 80,00' };
  assert.equal((await p.enviarMensagem({ ...entrada, imagemUrl: URL_FOTO })).sucesso, true);
  assert.match(chamadas[0].url, /sendImage$/); assert.equal(chamadas[0].body.file.url, URL_FOTO);
  assert.equal(chamadas[0].body.file.mimetype, 'image/jpeg'); assert.equal(chamadas[0].body.caption, entrada.texto);
  await p.enviarMensagem(entrada); assert.match(chamadas[1].url, /sendText$/); assert.equal(chamadas.length, 2);
});
test('Meta envia imagem + legenda usando o mesmo fluxo de envio', async () => {
  let body;
  const p = criarAdaptadorMeta({ phoneNumberId: '12345678', accessToken: 'fake-test-key', fetchFn: async (_, opts) => {
    body = JSON.parse(opts.body); return { ok: true, status: 200, text: async () => JSON.stringify({ messages: [{ id: 'wamid.photo' }] }) };
  } });
  const r = await p.enviarMensagem({ lojaId: LOJA, configuracaoId: CFG, contato: '5511999999999', texto: 'Camisa', imagemUrl: URL_FOTO });
  assert.equal(r.sucesso, true); assert.equal(body.type, 'image'); assert.equal(body.image.link, URL_FOTO); assert.equal(body.image.caption, 'Camisa');
});
test('WebP no caminho Meta usa link da foto em vez de mídia incompatível', () => {
  const { montarRequisicaoEnvioTexto } = require('../src/services/providers/whatsapp/clienteHttpMeta');
  const foto = URL_FOTO.replace('.jpg', '.webp');
  const req = montarRequisicaoEnvioTexto({ apiVersion: 'v26.0', phoneNumberId: '12345678', accessToken: 'fake-test-key', para: '5511999999999', texto: 'Camisa', imagemUrl: foto });
  const body = JSON.parse(req.body);
  assert.equal(body.type, 'text'); assert.equal(body.image, undefined); assert.ok(body.text.body.includes(foto));
});

test('IA recebe produtos e serviços no mesmo contexto com histórico preservado', async () => {
  const llm = require('../src/services/llm.service');
  const ia = require('../src/services/ia.service');
  const antes = { estaConfigurado: llm.estaConfigurado, gerarResposta: llm.gerarResposta };
  const memoria = [{ role: 'user', content: 'Quero tamanho M' }];
  supabase.from = criarSupabaseFake({ from: {
    produtos: { data: [{ nome: 'Camisa social', preco: 80, estoque: [{ tamanho: 'M', cor: 'Azul', quantidade: 1 }] }], error: null },
    saintsai_servicos: { data: [{ nome: 'Ajuste de roupa', preco: 20, duracao_min: 30 }], error: null },
    lojas: { data: { prompt_mestre: 'Somos uma loja de roupas e fazemos ajustes.' }, error: null }
  } }).from;
  llm.estaConfigurado = () => true;
  llm.gerarResposta = async entrada => {
    assert.match(entrada.contexto, /Camisa social/); assert.match(entrada.contexto, /Ajuste de roupa/);
    assert.match(entrada.contexto, /última unidade/); assert.deepEqual(entrada.historico, memoria);
    return 'Temos camisa social e ajuste de roupa.';
  };
  try { assert.equal(await ia.responderPergunta(LOJA, 'Tem camisa e ajuste?', memoria), 'Temos camisa social e ajuste de roupa.'); }
  finally { Object.assign(llm, antes); }
});
test('sem LLM, empresa de serviços recebe uma resposta baseada no serviço real', async () => {
  const llm = require('../src/services/llm.service'), ia = require('../src/services/ia.service');
  const antes = llm.estaConfigurado;
  supabase.from = criarSupabaseFake({ from: {
    produtos: { data: [], error: null },
    saintsai_servicos: { data: [{ nome: 'Corte', preco: 30, duracao_min: 40 }], error: null },
    lojas: { data: { prompt_mestre: 'Somos uma barbearia.' }, error: null }
  } }).from;
  llm.estaConfigurado = () => false;
  try { const r = await ia.responderPergunta(LOJA, 'Quanto é o corte?'); assert.match(r, /Corte/); assert.match(r, /30,00/); assert.doesNotMatch(r, /catálogo vazio/); }
  finally { llm.estaConfigurado = antes; }
});
