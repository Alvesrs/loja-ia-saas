const fs = require('node:fs');
const crypto = require('node:crypto');

function read(p){ return fs.readFileSync(p,'utf8'); }
function write(p,v){ fs.writeFileSync(p,v); }

// ---------- Upload seguro de imagem ----------
write('src/controllers/produtoImagem.controller.js', `
const crypto = require('node:crypto');
const supabase = require('../config/supabase');

const BUCKET = 'produto-imagens';
const MIME = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
});
const MAX_BYTES = 3 * 1024 * 1024;

async function garantirBucket() {
  const { data, error } = await supabase.storage.getBucket(BUCKET);
  if (!error && data) return;
  const criado = await supabase.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: Object.keys(MIME),
    fileSizeLimit: MAX_BYTES,
  });
  if (criado.error && !/already|exist/i.test(String(criado.error.message || ''))) throw criado.error;
}

async function upload(req, res) {
  try {
    const dataUrl = String(req.body?.data_url || '');
    const m = dataUrl.match(/^data:(image\\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return res.status(400).json({ erro: 'Imagem inválida. Use JPG, PNG ou WEBP.' });

    const contentType = m[1];
    const ext = MIME[contentType];
    const buffer = Buffer.from(m[2], 'base64');
    if (!buffer.length || buffer.length > MAX_BYTES) {
      return res.status(413).json({ erro: 'A imagem deve ter no máximo 3 MB.' });
    }

    await garantirBucket();
    const caminho = req.params.lojaId + '/' + crypto.randomUUID() + '.' + ext;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(caminho, buffer, { contentType, upsert: false, cacheControl: '3600' });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
    if (!data?.publicUrl) throw new Error('url_publica_ausente');

    return res.status(201).json({ imagem_url: data.publicUrl, imagem_path: caminho });
  } catch (erro) {
    console.error('[produto imagem] falha:', erro?.name || 'erro');
    return res.status(500).json({ erro: 'Não foi possível enviar a imagem do produto.' });
  }
}

module.exports = { upload };
`);

write('src/routes/produtoImagem.routes.js', `
const express = require('express');
const { exigirLogin } = require('../middleware/auth');
const { exigirDonoDaLoja } = require('../middleware/lojaOwnership');
const controller = require('../controllers/produtoImagem.controller');

const router = express.Router({ mergeParams: true });
router.use(express.json({ limit: '5mb' }));
router.use(exigirLogin);
router.use(exigirDonoDaLoja);
router.post('/', controller.upload);
module.exports = router;
`);

let app = read('src/app.js');
if (!app.includes("produtoImagemRoutes")) {
  app = app.replace(
    "const adminRoutes = require('./routes/admin.routes');",
    "const adminRoutes = require('./routes/admin.routes');\nconst produtoImagemRoutes = require('./routes/produtoImagem.routes');"
  );
  app = app.replace(
    "// Limite de tamanho do corpo da requisição, para evitar abuso com payloads",
    "app.use('/api/lojas/:lojaId/produto-imagem', produtoImagemRoutes);\n\n// Limite de tamanho do corpo da requisição, para evitar abuso com payloads"
  );
}
write('src/app.js', app);

// ---------- Produto aceita referência da imagem ----------
let pc = read('src/controllers/produtos.controller.js');
pc = pc.replace(
  "const { nome, descricao, preco, categoria } = req.body;",
  "const { nome, descricao, preco, categoria, imagem_url, imagem_path } = req.body;"
);
pc = pc.replace(
  ".insert({ loja_id: lojaId, nome: nome.trim(), descricao, preco, categoria })",
  ".insert({ loja_id: lojaId, nome: nome.trim(), descricao, preco, categoria, imagem_url: imagem_url || null, imagem_path: imagem_path || null })"
);
pc = pc.replace(
  "const { nome, descricao, preco, categoria, ativo } = req.body;",
  "const { nome, descricao, preco, categoria, ativo, imagem_url, imagem_path } = req.body;"
);
if (!pc.includes("if (imagem_url !== undefined)")) {
  pc = pc.replace(
    "  if (ativo !== undefined) {",
    `  if (imagem_url !== undefined) {
    if (imagem_url !== null && typeof imagem_url !== 'string') {
      return res.status(400).json({ erro: 'Imagem inválida.' });
    }
    dadosAtualizados.imagem_url = imagem_url;
  }

  if (imagem_path !== undefined) {
    if (imagem_path !== null && typeof imagem_path !== 'string') {
      return res.status(400).json({ erro: 'Caminho da imagem inválido.' });
    }
    dadosAtualizados.imagem_path = imagem_path;
  }

  if (ativo !== undefined) {`
  );
}
write('src/controllers/produtos.controller.js', pc);

// ---------- Página Produtos exclusiva do app cliente ----------
const produtosHtml = read('public/produtos.html');
let produtosJs = read('public/js/produtos.js');
const inicio = produtosHtml.indexOf('<main class="page">');
const fim = produtosHtml.indexOf('</main>', inicio);
if (inicio < 0 || fim < 0) throw new Error('Main de produtos não encontrado');
const mainProdutos = produtosHtml.slice(inicio, fim + 7);

produtosJs = produtosJs.replace(/\nmontarLayout\('produtos'\);\s*\ncarregarProdutos\(\);\s*$/m, '\ncarregarProdutos();\n');

// Campo de imagem no modal.
produtosJs = produtosJs.replace(
  '      <div class="modal-actions">',
  `      <div class="field">
        <label for="campo-imagem">Imagem do produto</label>
        <input type="file" id="campo-imagem" accept="image/jpeg,image/png,image/webp">
        <div class="field-help">JPG, PNG ou WEBP, até 3 MB. A foto será usada pelo agente somente quando fizer sentido na conversa.</div>
        <div id="preview-imagem-produto" style="margin-top:10px"></div>
      </div>
      <div class="modal-actions">`
);

// Preview ao editar.
produtosJs = produtosJs.replace(
  "  document.getElementById('campo-nome').focus();",
  `  const previewImagem = document.getElementById('preview-imagem-produto');
  if (editando && produtoExistente.imagem_url) {
    previewImagem.innerHTML = '<img src="' + produtoExistente.imagem_url + '" alt="Imagem do produto" style="max-width:160px;max-height:160px;border-radius:12px;object-fit:cover">';
  }
  document.getElementById('campo-imagem').addEventListener('change', (e) => {
    const arq = e.target.files && e.target.files[0];
    if (!arq) return;
    if (arq.size > 3 * 1024 * 1024) {
      mostrarToast('A imagem deve ter no máximo 3 MB.', 'erro');
      e.target.value = '';
      return;
    }
    const url = URL.createObjectURL(arq);
    previewImagem.innerHTML = '<img src="' + url + '" alt="Prévia" style="max-width:160px;max-height:160px;border-radius:12px;object-fit:cover">';
  });
  document.getElementById('campo-nome').focus();`
);

// Upload antes de montar corpo.
produtosJs = produtosJs.replace(
  "    const corpo = {\n      nome,\n      descricao: descricao || null,\n      preco,\n      categoria: categoria || null,\n    };",
  `    let imagemUrl = editando ? (produtoExistente.imagem_url || null) : null;
    let imagemPath = editando ? (produtoExistente.imagem_path || null) : null;
    const arquivoImagem = document.getElementById('campo-imagem').files[0];

    if (arquivoImagem) {
      const dataUrl = await new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(String(leitor.result || ''));
        leitor.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
        leitor.readAsDataURL(arquivoImagem);
      });
      const upload = await apiFetch('/lojas/' + lojaAtualId + '/produto-imagem', {
        method: 'POST',
        body: JSON.stringify({ data_url: dataUrl }),
      });
      imagemUrl = upload.imagem_url;
      imagemPath = upload.imagem_path;
    }

    const corpo = {
      nome,
      descricao: descricao || null,
      preco,
      categoria: categoria || null,
      imagem_url: imagemUrl,
      imagem_path: imagemPath,
    };`
);

write('public/js/cliente-produtos.js', produtosJs);

write('public/cliente-produtos.html', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover">
<meta name="theme-color" content="#08070d">
<title>Produtos · SaintsAI Estoque</title>
<link rel="stylesheet" href="css/styles.css">
<script src="js/theme.js"></script>
<script src="js/guard.js"></script>
<style>
html,body{margin:0;min-height:100%;background:#08070d;color:#fff}
.cliente-top{position:sticky;top:0;z-index:30;background:rgba(8,7,13,.97);backdrop-filter:blur(14px);border-bottom:1px solid rgba(160,95,255,.25);padding:14px 16px 12px}
.cliente-brand{font-weight:800;font-size:18px;margin-bottom:12px}
.cliente-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.cliente-tab{border:1px solid rgba(170,110,255,.25);background:#111018;color:#c8c3d0;border-radius:14px;padding:11px 7px;font-weight:700;text-decoration:none;text-align:center}
.cliente-tab.ativo{background:linear-gradient(135deg,#7d35ff,#b05cff);color:#fff;border-color:transparent}
.page{padding:18px 16px 40px;max-width:900px;margin:0 auto}
</style>
</head>
<body>
<header class="cliente-top">
  <div class="cliente-brand">SaintsAI Estoque</div>
  <div class="cliente-tabs">
    <a class="cliente-tab" href="cliente-estoque.html">Estoque</a>
    <a class="cliente-tab ativo" href="cliente-produtos.html">Produtos</a>
    <a class="cliente-tab" href="cliente-estoque.html?secao=agente">Gerenciar agente</a>
  </div>
</header>
${mainProdutos}
<script src="js/config.js"></script>
<script src="js/auth.js"></script>
<script src="js/api.js"></script>
<script src="js/loja.js"></script>
<script src="js/components.js"></script>
<script src="js/cliente-produtos.js"></script>
<script>
document.getElementById('botao-tentar-novamente')?.addEventListener('click', function(e){e.preventDefault();carregarProdutos();});
</script>
</body>
</html>`);

// Ajusta a página Estoque existente para mostrar 3 abas.
let clienteEstoque = read('public/cliente-estoque.html');
clienteEstoque = clienteEstoque
  .replace('grid-template-columns:1fr 1fr', 'grid-template-columns:repeat(3,1fr)')
  .replace(
    '<button id="tab-estoque" class="cliente-tab ativo" type="button">Estoque</button>\n      <button id="tab-agente" class="cliente-tab" type="button">Gerenciar agente</button>',
    '<button id="tab-estoque" class="cliente-tab ativo" type="button">Estoque</button>\n      <a class="cliente-tab" href="cliente-produtos.html" style="text-decoration:none;text-align:center">Produtos</a>\n      <button id="tab-agente" class="cliente-tab" type="button">Gerenciar agente</button>'
  )
  .replace('Peça ao administrador para cadastrar o primeiro produto.', 'Cadastre seu primeiro produto na aba Produtos.')
  .replace(
    "carregarEstoque();",
    "carregarEstoque();\nif (new URLSearchParams(location.search).get('secao') === 'agente') { setTimeout(() => tabAgente.click(), 0); }"
  );
write('public/cliente-estoque.html', clienteEstoque);

console.log('Patch de cadastro de produto com imagem no app cliente aplicado.');
