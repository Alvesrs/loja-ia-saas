/**
 * Testes de unidade dos middlewares src/middleware/auth.js e
 * src/middleware/lojaOwnership.js — a linha de frente contra acesso não
 * autenticado e contra IDOR/BOLA entre lojas.
 *
 * Cobre os cenários da auditoria:
 *   A) usuário não autenticado tentando acessar rota protegida;
 *   B) usuário da Loja A tentando acessar produto da Loja B;
 *   C) usuário da Loja A tentando alterar estoque da Loja B.
 *
 * Usa Supabase falso (sem rede) via tests/helpers/mockSupabaseModule.js.
 * Rodar com: node --test tests/middlewareAutorizacao.test.js
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');

const { instalarMockSupabaseJs } = require('./helpers/mockSupabaseModule');
instalarMockSupabaseJs();

const supabase = require('../src/config/supabase');
const { criarSupabaseFake } = require('./helpers/supabaseFake');
const { criarResMock, criarNextMock } = require('./helpers/httpMocks');
const { exigirLogin } = require('../src/middleware/auth');
const { exigirDonoDaLoja, exigirProdutoDaLoja } = require('../src/middleware/lojaOwnership');

const UUID_LOJA_A = '11111111-1111-1111-1111-111111111111';
const UUID_PRODUTO_B = '22222222-2222-2222-2222-222222222222';

// --- exigirLogin (autenticação) -----------------------------------------

test('exigirLogin: cenário A — sem token → 401, next() não é chamado', async () => {
  const req = { headers: {} };
  const res = criarResMock();
  const next = criarNextMock();

  await exigirLogin(req, res, next);

  assert.equal(next.info.vezes, 0);
  assert.equal(res.statusCode, 401);
});

test('exigirLogin: token inválido/expirado → 401, next() não é chamado', async () => {
  const fake = criarSupabaseFake({ auth: { getUser: () => ({ data: { user: null }, error: { message: 'expirado', status:401 } }) } });
  supabase.auth = fake.auth;

  const req = { headers: { authorization: 'Bearer token-invalido' } };
  const res = criarResMock();
  const next = criarNextMock();

  await exigirLogin(req, res, next);

  assert.equal(next.info.vezes, 0);
  assert.equal(res.statusCode, 401);
});

test('exigirLogin: token válido → anexa req.usuario e chama next()', async () => {
  const usuarioFake = { id: 'usuario-A', email: 'a@teste.com' };
  const fake = criarSupabaseFake({ auth: { getUser: () => ({ data: { user: usuarioFake }, error: null }) } });
  supabase.auth = fake.auth;

  const req = { headers: { authorization: 'Bearer token-valido' } };
  const res = criarResMock();
  const next = criarNextMock();

  await exigirLogin(req, res, next);

  assert.equal(next.info.vezes, 1);
  assert.deepEqual(req.usuario, usuarioFake);
  assert.equal(res.statusCode, null);
});

// --- exigirDonoDaLoja (cenário B) ----------------------------------------

test('exigirDonoDaLoja: :lojaId com formato inválido → 400, sem consultar o banco', async () => {
  const fake = criarSupabaseFake({});
  supabase.from = fake.from;

  const req = { params: { lojaId: 'nao-e-uuid' }, usuario: { id: 'usuario-A' } };
  const res = criarResMock();
  const next = criarNextMock();

  await exigirDonoDaLoja(req, res, next);

  assert.equal(res.statusCode, 400);
  assert.equal(next.info.vezes, 0);
  assert.equal(fake.chamadasFrom.length, 0);
});

test('exigirDonoDaLoja: cenário B — usuário A tentando loja de outro dono → 403', async () => {
  const fake = criarSupabaseFake({ from: { lojas: { data: null, error: null } } });
  supabase.from = fake.from;

  const req = { params: { lojaId: UUID_LOJA_A }, usuario: { id: 'usuario-A' } };
  const res = criarResMock();
  const next = criarNextMock();

  await exigirDonoDaLoja(req, res, next);

  assert.equal(res.statusCode, 403);
  assert.equal(next.info.vezes, 0);
});

test('exigirDonoDaLoja: loja realmente pertence ao usuário → chama next()', async () => {
  const fake = criarSupabaseFake({ from: { lojas: { data: { id: UUID_LOJA_A }, error: null } } });
  supabase.from = fake.from;

  const req = { params: { lojaId: UUID_LOJA_A }, usuario: { id: 'usuario-A' } };
  const res = criarResMock();
  const next = criarNextMock();

  await exigirDonoDaLoja(req, res, next);

  assert.equal(next.info.vezes, 1);
  assert.equal(res.statusCode, null);
});

// --- exigirProdutoDaLoja (cenário C: base para bloquear alteração de estoque) --

test('exigirProdutoDaLoja: cenário C — produto pertence a OUTRA loja → 403 (bloqueia antes de chegar no controller de estoque)', async () => {
  const fake = criarSupabaseFake({ from: { produtos: { data: null, error: null } } });
  supabase.from = fake.from;

  const req = { params: { lojaId: UUID_LOJA_A, produtoId: UUID_PRODUTO_B } };
  const res = criarResMock();
  const next = criarNextMock();

  await exigirProdutoDaLoja(req, res, next);

  assert.equal(res.statusCode, 403);
  assert.equal(next.info.vezes, 0);
});

test('exigirProdutoDaLoja: produto realmente pertence à loja → chama next()', async () => {
  const fake = criarSupabaseFake({ from: { produtos: { data: { id: UUID_PRODUTO_B }, error: null } } });
  supabase.from = fake.from;

  const req = { params: { lojaId: UUID_LOJA_A, produtoId: UUID_PRODUTO_B } };
  const res = criarResMock();
  const next = criarNextMock();

  await exigirProdutoDaLoja(req, res, next);

  assert.equal(next.info.vezes, 1);
});
