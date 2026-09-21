const fs = require('node:fs');

function read(p){ return fs.readFileSync(p,'utf8'); }
function write(p,v){ fs.writeFileSync(p,v); }

// Admin pode operar lojas de clientes criados pelo próprio SaintsAI.
// Usuários comuns continuam limitados às próprias lojas.
let own = read('src/middleware/lojaOwnership.js');
if (!own.includes("usuarioEhAdmin")) {
  own = own.replace(
    "const { ehUuid } = require('../utils/validacao');",
    "const { ehUuid } = require('../utils/validacao');\nconst { usuarioEhAdmin } = require('./admin');\nconst supabase = require('../config/supabase');\nconst supabaseAuth = require('../config/supabaseAuth');"
  );

  own = own.replace(
    "  const pertence = await lojaPertenceAoUsuario(lojaId, req.usuario.id);\n  if (!pertence) {\n    return res.status(403).json({ erro: 'Você não tem acesso a essa loja.' });\n  }\n\n  next();",
    `  const pertence = await lojaPertenceAoUsuario(lojaId, req.usuario.id);
  if (pertence) return next();

  if (usuarioEhAdmin(req.usuario)) {
    try {
      const { data: loja, error } = await supabase
        .from('lojas')
        .select('dono_id')
        .eq('id', lojaId)
        .maybeSingle();

      if (!error && loja?.dono_id) {
        const { data: usuarioCliente } = await supabaseAuth.auth.admin.getUserById(loja.dono_id);
        if (usuarioCliente?.user?.app_metadata?.saintsai_managed === true) {
          req.acessoAdminCliente = true;
          return next();
        }
      }
    } catch (_) {}
  }

  return res.status(403).json({ erro: 'Você não tem acesso a essa loja.' });`
  );
}
write('src/middleware/lojaOwnership.js', own);

let lojas = read('src/controllers/lojas.controller.js');
if (!lojas.includes("usuarioEhAdmin")) {
  lojas = lojas.replace(
    "const { ehStringNaoVazia } = require('../utils/validacao');",
    "const { ehStringNaoVazia } = require('../utils/validacao');\nconst { usuarioEhAdmin } = require('../middleware/admin');\nconst supabaseAuth = require('../config/supabaseAuth');"
  );

  const antigo = `async function listarMinhasLojas(req, res) {
  const { data, error } = await supabase
    .from('lojas')
    .select('*')
    .eq('dono_id', req.usuario.id)
    .order('criado_em', { ascending: false });

  if (error) return tratarErroBanco(res, error);
  return res.json(data);
}`;

  const novo = `async function listarMinhasLojas(req, res) {
  let donosPermitidos = [req.usuario.id];

  if (usuarioEhAdmin(req.usuario)) {
    try {
      const gerenciados = [];
      let pagina = 1;
      for (;;) {
        const { data: paginaUsuarios, error: erroUsuarios } = await supabaseAuth.auth.admin.listUsers({
          page: pagina,
          perPage: 1000,
        });
        if (erroUsuarios) throw erroUsuarios;
        const lote = Array.isArray(paginaUsuarios?.users) ? paginaUsuarios.users : [];
        for (const u of lote) {
          if (u?.app_metadata?.saintsai_managed === true) gerenciados.push(u.id);
        }
        if (lote.length < 1000 || pagina >= 20) break;
        pagina += 1;
      }
      donosPermitidos = Array.from(new Set([req.usuario.id, ...gerenciados]));
    } catch (erroAdmin) {
      console.error('[lojas] falha ao listar clientes gerenciados:', erroAdmin?.name || 'erro');
    }
  }

  const { data, error } = await supabase
    .from('lojas')
    .select('*')
    .in('dono_id', donosPermitidos)
    .order('criado_em', { ascending: false });

  if (error) return tratarErroBanco(res, error);

  const lista = (data || []).map(loja => ({
    ...loja,
    cliente_gerenciado: loja.dono_id !== req.usuario.id,
  }));

  return res.json(lista);
}`;

  if (!lojas.includes(antigo)) throw new Error('listarMinhasLojas não encontrado');
  lojas = lojas.replace(antigo, novo);
}
write('src/controllers/lojas.controller.js', lojas);

console.log('Patch de seletor Admin com clientes gerenciados aplicado.');
