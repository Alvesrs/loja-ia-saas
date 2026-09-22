const fs = require('node:fs');

const file = 'src/app.js';
let src = fs.readFileSync(file, 'utf8');

if (src.includes('SAINTSAI_PUBLIC_PANEL_MOUNT')) {
  console.log('Mount público do painel já aplicado.');
  process.exit(0);
}

if (!src.includes("require('node:path')") && !src.includes('require("node:path")')) {
  src = "const path = require('node:path');\n" + src;
}

const block = `
// SAINTSAI_PUBLIC_PANEL_MOUNT
const saintsaiPublicDir = path.join(process.cwd(), 'public');
app.get('/painel', (_req, res) => {
  res.sendFile(path.join(saintsaiPublicDir, 'login.html'));
});
app.use('/painel', express.static(saintsaiPublicDir, {
  index: false,
  fallthrough: true,
  redirect: false,
}));
`;

let insertAt = -1;
const notFoundText = 'Rota não encontrada.';
const nf = src.indexOf(notFoundText);
if (nf >= 0) {
  insertAt = src.lastIndexOf('\napp.use', nf);
}
if (insertAt < 0) {
  const exported = src.indexOf('module.exports = app');
  if (exported >= 0) insertAt = exported;
}
if (insertAt < 0) {
  throw new Error('Não foi possível localizar o ponto seguro para montar /painel.');
}

src = src.slice(0, insertAt) + '\n' + block + '\n' + src.slice(insertAt);
fs.writeFileSync(file, src);
console.log('Mount público /painel aplicado.');
