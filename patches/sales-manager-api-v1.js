
const fs = require('node:fs');

const routesPath = 'src/routes/sales-manager.routes.js';
fs.writeFileSync(routesPath, \`
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Supabase não configurado para Gerenciador de Vendas');

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function authClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
function bearer(req) {
  const h = String(req.headers.authorization || '');
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}
function adminEmails() {
  return String(process.env.SAAS_ADMIN_EMAILS || '')
    .split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
}
async function requireUser(req, res, next) {
  try {
    const token = bearer(req);
    if (!token) return res.status(401).json({ erro: 'Sessão ausente.' });
    const { data, error } = await authClient().auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ erro: 'Sessão inválida.' });

    const { data: membro, error: mErr } = await db
      .from('gv_membros')
      .select('id,empresa_id,nome,papel,ativo,gv_empresas(id,nome,ativo)')
      .eq('user_id', data.user.id)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle();

    if (mErr) throw mErr;
    if (!membro || !membro.gv_empresas?.ativo) {
      return res.status(403).json({ erro: 'Esta conta não possui acesso ao Gerenciador.' });
    }
    req.gv = { user: data.user, membro, empresa: membro.gv_empresas };
    next();
  } catch (e) {
    console.error('[gv auth]', e);
    res.status(500).json({ erro: 'Falha ao validar acesso.' });
  }
}
async function requireOwner(req, res, next) {
  try {
    const token = bearer(req);
    if (!token) return res.status(401).json({ erro: 'Sessão ausente.' });
    const { data, error } = await authClient().auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ erro: 'Sessão inválida.' });
    if (!adminEmails().includes(String(data.user.email || '').toLowerCase())) {
      return res.status(403).json({ erro: 'Acesso administrativo necessário.' });
    }
    req.ownerUser = data.user;
    next();
  } catch (e) {
    console.error('[gv owner auth]', e);
    res.status(500).json({ erro: 'Falha ao validar administrador.' });
  }
}
const safeMoney = v => Math.max(0, Number(v || 0));
const isoMonthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const addMonths = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const senha = String(req.body?.senha || '');
    if (!email || !senha) return res.status(400).json({ erro: 'Informe e-mail e senha.' });

    const c = authClient();
    const { data, error } = await c.auth.signInWithPassword({ email, password: senha });
    if (error || !data?.session || !data?.user) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }

    const { data: membro, error: mErr } = await db
      .from('gv_membros')
      .select('id,empresa_id,nome,papel,ativo,gv_empresas(id,nome,ativo)')
      .eq('user_id', data.user.id)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!membro || !membro.gv_empresas?.ativo) {
      return res.status(403).json({ erro: 'Esta conta não possui acesso ao Gerenciador.' });
    }

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      usuario: { id: data.user.id, email: data.user.email, nome: membro.nome, papel: membro.papel },
      empresa: membro.gv_empresas
    });
  } catch (e) {
    console.error('[gv login]', e);
    res.status(500).json({ erro: 'Não foi possível entrar.' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const refresh_token = String(req.body?.refresh_token || '');
    if (!refresh_token) return res.status(400).json({ erro: 'Refresh token ausente.' });
    const { data, error } = await authClient().auth.refreshSession({ refresh_token });
    if (error || !data?.session) return res.status(401).json({ erro: 'Sessão expirada.' });
    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at
    });
  } catch (e) {
    res.status(401).json({ erro: 'Sessão expirada.' });
  }
});

router.get('/contexto', requireUser, async (req, res) => {
  res.json({
    usuario: { id: req.gv.user.id, email: req.gv.user.email, nome: req.gv.membro.nome, papel: req.gv.membro.papel },
    empresa: req.gv.empresa
  });
});

router.get('/vendas', requireUser, async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 100)));
    const { data, error } = await db.from('gv_vendas')
      .select('*').eq('empresa_id', req.gv.empresa.id)
      .order('vendido_em', { ascending: false }).limit(limit);
    if (error) throw error;
    res.json({ vendas: data || [] });
  } catch (e) {
    console.error('[gv vendas list]', e);
    res.status(500).json({ erro: 'Não foi possível carregar as vendas.' });
  }
});

router.post('/vendas', requireUser, async (req, res) => {
  try {
    const cliente_nome = String(req.body?.cliente_nome || '').trim();
    const valor = safeMoney(req.body?.valor);
    if (!cliente_nome || !(valor > 0)) return res.status(400).json({ erro: 'Informe cliente e valor maior que zero.' });

    let cliente_id = req.body?.cliente_id || null;
    if (!cliente_id) {
      const { data: existente } = await db.from('gv_clientes')
        .select('id').eq('empresa_id', req.gv.empresa.id)
        .ilike('nome', cliente_nome).limit(1).maybeSingle();
      if (existente?.id) cliente_id = existente.id;
      else {
        const { data: novo, error: cErr } = await db.from('gv_clientes').insert({
          empresa_id: req.gv.empresa.id, nome: cliente_nome
        }).select('id').single();
        if (cErr) throw cErr;
        cliente_id = novo.id;
      }
    }

    const payload = {
      empresa_id: req.gv.empresa.id,
      cliente_id,
      produto_id: req.body?.produto_id || null,
      vendedor_user_id: req.gv.user.id,
      cliente_nome,
      produto_nome: String(req.body?.produto_nome || '').trim() || null,
      categoria: String(req.body?.categoria || '').trim() || null,
      origem: String(req.body?.origem || 'WhatsApp').trim(),
      valor,
      custo: safeMoney(req.body?.custo),
      observacao: String(req.body?.observacao || '').trim() || null,
      vendido_em: req.body?.vendido_em ? new Date(req.body.vendido_em).toISOString() : new Date().toISOString()
    };
    const { data, error } = await db.from('gv_vendas').insert(payload).select('*').single();
    if (error) throw error;
    res.status(201).json({ venda: data });
  } catch (e) {
    console.error('[gv venda create]', e);
    res.status(500).json({ erro: 'Não foi possível registrar a venda.' });
  }
});

router.get('/clientes', requireUser, async (req, res) => {
  const { data, error } = await db.from('gv_clientes').select('*')
    .eq('empresa_id', req.gv.empresa.id).order('nome');
  if (error) return res.status(500).json({ erro: 'Não foi possível carregar clientes.' });
  res.json({ clientes: data || [] });
});
router.post('/clientes', requireUser, async (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório.' });
  const { data, error } = await db.from('gv_clientes').insert({
    empresa_id: req.gv.empresa.id, nome,
    telefone: String(req.body?.telefone || '').trim() || null,
    email: String(req.body?.email || '').trim() || null
  }).select('*').single();
  if (error) return res.status(500).json({ erro: 'Não foi possível cadastrar cliente.' });
  res.status(201).json({ cliente: data });
});

router.get('/produtos', requireUser, async (req, res) => {
  const { data, error } = await db.from('gv_produtos').select('*')
    .eq('empresa_id', req.gv.empresa.id).eq('ativo', true).order('nome');
  if (error) return res.status(500).json({ erro: 'Não foi possível carregar produtos.' });
  res.json({ produtos: data || [] });
});
router.post('/produtos', requireUser, async (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório.' });
  const { data, error } = await db.from('gv_produtos').insert({
    empresa_id: req.gv.empresa.id, nome,
    categoria: String(req.body?.categoria || '').trim() || null,
    preco: req.body?.preco == null ? null : safeMoney(req.body.preco),
    custo: req.body?.custo == null ? null : safeMoney(req.body.custo)
  }).select('*').single();
  if (error) return res.status(500).json({ erro: 'Não foi possível cadastrar produto.' });
  res.status(201).json({ produto: data });
});

router.get('/dashboard', requireUser, async (req, res) => {
  try {
    const now = new Date();
    const ini = isoMonthStart(now);
    const fim = addMonths(ini, 1);
    const prevIni = addMonths(ini, -1);

    const [{ data: atual, error: aErr }, { data: anterior, error: pErr }] = await Promise.all([
      db.from('gv_vendas').select('id,cliente_id,cliente_nome,categoria,origem,valor,custo,vendido_em')
        .eq('empresa_id', req.gv.empresa.id).gte('vendido_em', ini.toISOString()).lt('vendido_em', fim.toISOString()),
      db.from('gv_vendas').select('id,valor,custo')
        .eq('empresa_id', req.gv.empresa.id).gte('vendido_em', prevIni.toISOString()).lt('vendido_em', ini.toISOString())
    ]);
    if (aErr || pErr) throw aErr || pErr;

    const vendas = atual || [];
    const prev = anterior || [];
    const faturamento = vendas.reduce((s,v)=>s+Number(v.valor||0),0);
    const lucro = vendas.reduce((s,v)=>s+Number(v.valor||0)-Number(v.custo||0),0);
    const prevFat = prev.reduce((s,v)=>s+Number(v.valor||0),0);
    const clientes = new Set(vendas.map(v=>v.cliente_id || v.cliente_nome).filter(Boolean)).size;
    const ticket = vendas.length ? faturamento / vendas.length : 0;

    const porDia = {};
    const origens = {};
    const categorias = {};
    for (const v of vendas) {
      const dia = String(v.vendido_em).slice(0,10);
      porDia[dia] = (porDia[dia] || 0) + Number(v.valor || 0);
      origens[v.origem || 'Outro'] = (origens[v.origem || 'Outro'] || 0) + 1;
      categorias[v.categoria || 'Sem categoria'] = (categorias[v.categoria || 'Sem categoria'] || 0) + Number(v.valor || 0);
    }

    res.json({
      metricas: {
        faturamento, lucro, vendas: vendas.length, ticket_medio: ticket, clientes,
        faturamento_anterior: prevFat,
        variacao_faturamento_pct: prevFat > 0 ? ((faturamento-prevFat)/prevFat)*100 : null
      },
      por_dia: Object.entries(porDia).map(([data,valor])=>({data,valor})).sort((a,b)=>a.data.localeCompare(b.data)),
      origens: Object.entries(origens).map(([nome,total])=>({nome,total})).sort((a,b)=>b.total-a.total),
      categorias: Object.entries(categorias).map(([nome,valor])=>({nome,valor})).sort((a,b)=>b.valor-a.valor).slice(0,8),
      ultimas_vendas: [...vendas].sort((a,b)=>String(b.vendido_em).localeCompare(String(a.vendido_em))).slice(0,10)
    });
  } catch (e) {
    console.error('[gv dashboard]', e);
    res.status(500).json({ erro: 'Não foi possível carregar o dashboard.' });
  }
});

// Provisionamento para o painel do proprietário.
router.get('/admin/contas', requireOwner, async (_req, res) => {
  const { data, error } = await db.from('gv_empresas').select('id,nome,ativo,criado_em,gv_membros(id,user_id,nome,papel,ativo)');
  if (error) return res.status(500).json({ erro: 'Não foi possível listar contas.' });
  res.json({ contas: data || [] });
});
router.post('/admin/contas', requireOwner, async (req, res) => {
  try {
    const empresaNome = String(req.body?.empresa || '').trim();
    const nome = String(req.body?.nome || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const senha = String(req.body?.senha || '');
    if (!empresaNome || !email || senha.length < 6) return res.status(400).json({ erro: 'Informe empresa, e-mail e senha com pelo menos 6 caracteres.' });

    const { data: created, error: uErr } = await db.auth.admin.createUser({
      email, password: senha, email_confirm: true,
      app_metadata: { product: 'sales_manager', gv_managed: true }
    });
    if (uErr || !created?.user) return res.status(400).json({ erro: uErr?.message || 'Não foi possível criar usuário.' });

    const { data: empresa, error: eErr } = await db.from('gv_empresas').insert({ nome: empresaNome }).select('*').single();
    if (eErr) { await db.auth.admin.deleteUser(created.user.id); throw eErr; }

    const { error: mErr } = await db.from('gv_membros').insert({
      empresa_id: empresa.id, user_id: created.user.id, nome: nome || empresaNome, papel: 'admin'
    });
    if (mErr) throw mErr;

    res.status(201).json({ empresa, usuario: { id: created.user.id, email: created.user.email, nome: nome || empresaNome } });
  } catch (e) {
    console.error('[gv admin create]', e);
    res.status(500).json({ erro: 'Não foi possível criar a conta do Gerenciador.' });
  }
});

module.exports = router;
\`);

const appPath = 'src/app.js';
let app = fs.readFileSync(appPath, 'utf8');
const marker = '// SALES_MANAGER_API_V1';
if (!app.includes(marker)) {
  const block = \`
// SALES_MANAGER_API_V1
app.use('/api/gv', require('./routes/sales-manager.routes'));
\`;
  let idx = app.indexOf("app.use('/api/");
  if (idx < 0) idx = app.indexOf('module.exports');
  if (idx < 0) throw new Error('Ponto de montagem da API do Gerenciador não encontrado');
  app = app.slice(0, idx) + block + '\\n' + app.slice(idx);
  fs.writeFileSync(appPath, app);
}
console.log('Sales Manager API V1 aplicada.');
