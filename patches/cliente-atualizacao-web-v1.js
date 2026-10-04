const fs = require('node:fs');
const cp = require('node:child_process');
fs.copyFileSync('patches/assets/cliente-atualizacao.js', 'public/js/cliente-atualizacao.js');
fs.writeFileSync('public/cliente-versao.json', JSON.stringify({
  versao: '2026.10.04.1', publicado_em: '2026-10-04',
  novidades: ['Produtos e serviços no atendimento', 'Fotos cadastradas no WhatsApp', 'Contexto recente', 'Correções da IA pelo dono']
}) + '\n');
let app = fs.readFileSync('src/app.js', 'utf8');
if (!app.includes('SAINTSAI_CLIENT_WEB_RELEASE_V1')) {
  const anchor = "app.get('/cliente',";
  if (!app.includes(anchor)) throw new Error('Portal do cliente não encontrado');
  app = app.replace(anchor, `// SAINTSAI_CLIENT_WEB_RELEASE_V1
app.get('/cliente/versao.json', (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.sendFile(__saintsaiClientPath.join(__saintsaiClientDir, 'cliente-versao.json'));
});
app.use('/cliente', (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});
` + anchor);
  fs.writeFileSync('src/app.js', app);
}
let html = fs.readFileSync('public/cliente-central.html', 'utf8');
if (!html.includes('js/cliente-atualizacao.js')) {
  html = html.replace('</body>', '<script src="js/cliente-atualizacao.js?v=2026.10.04.1"></script></body>');
  fs.writeFileSync('public/cliente-central.html', html);
}
cp.execFileSync(process.execPath, ['--check', 'public/js/cliente-atualizacao.js'], { stdio: 'inherit' });
cp.execFileSync(process.execPath, ['--check', 'src/app.js'], { stdio: 'inherit' });
console.log('[cliente-atualizacao-web-v1] atualização pelo app e versão pública configuradas.');
