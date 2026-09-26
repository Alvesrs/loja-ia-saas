const fs = require('node:fs');

const file = 'src/app.js';
let src = fs.readFileSync(file, 'utf8');

const marker = '// SAINTSAI_PUBLIC_PANEL_V2_20260922';
if (src.includes(marker)) {
  console.log('Mount público /painel V2 já aplicado.');
  process.exit(0);
}

const block = `
// SAINTSAI_PUBLIC_PANEL_V2_20260922
const __saintsaiPath = require('node:path');
const __saintsaiPublicDir = __saintsaiPath.join(process.cwd(), 'public');

function __saintsaiSendHtml(res, arquivo) {
  res.status(200);
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  return res.send(fs.readFileSync(__saintsaiPath.join(__saintsaiPublicDir, arquivo), 'utf8'));
}
app.get('/painel', (_req, res) => __saintsaiSendHtml(res, 'login.html'));
app.get('/painel/', (_req, res) => __saintsaiSendHtml(res, 'login.html'));
app.get('/painel/login.html', (_req, res) => __saintsaiSendHtml(res, 'login.html'));
app.get('/painel/cliente-central.html', (_req, res) => __saintsaiSendHtml(res, 'cliente-central.html'));
app.use('/painel', require('express').static(__saintsaiPublicDir, {
  index: false,
  fallthrough: true,
  redirect: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
    else if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    else if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
  }
}));
`;

let insertAt = -1;
const apiAuthSingle = src.indexOf("app.use('/api/auth'");
const apiAuthDouble = src.indexOf('app.use("/api/auth"');
if (apiAuthSingle >= 0 && apiAuthDouble >= 0) insertAt = Math.min(apiAuthSingle, apiAuthDouble);
else insertAt = Math.max(apiAuthSingle, apiAuthDouble);

if (insertAt < 0) {
  const firstUse = src.indexOf('app.use(');
  if (firstUse >= 0) insertAt = firstUse;
}

if (insertAt < 0) {
  const exported = src.indexOf('module.exports = app');
  if (exported >= 0) insertAt = exported;
}

if (insertAt < 0) {
  throw new Error('Não foi possível localizar ponto para montar /painel.');
}

src = src.slice(0, insertAt) + block + '\n' + src.slice(insertAt);
fs.writeFileSync(file, src);
console.log('Mount público /painel V2 aplicado sem cache.');
