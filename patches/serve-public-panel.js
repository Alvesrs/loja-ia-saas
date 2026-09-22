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

app.get('/painel', (_req, res) => {
  res.sendFile(__saintsaiPath.join(__saintsaiPublicDir, 'login.html'));
});
app.get('/painel/', (_req, res) => {
  res.sendFile(__saintsaiPath.join(__saintsaiPublicDir, 'login.html'));
});
app.use('/painel', require('express').static(__saintsaiPublicDir, {
  index: false,
  fallthrough: true,
  redirect: false,
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
