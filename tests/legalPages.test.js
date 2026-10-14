const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('páginas públicas de privacidade e exclusão existem e têm conteúdo essencial', () => {
  const privacy = fs.readFileSync(path.join(__dirname, '..', 'public', 'legal', 'privacidade', 'index.html'), 'utf8');
  const deletion = fs.readFileSync(path.join(__dirname, '..', 'public', 'legal', 'exclusao', 'index.html'), 'utf8');
  assert.match(privacy, /Política de Privacidade/i);
  assert.match(privacy, /WhatsApp/i);
  assert.match(privacy, /Exclusão de Dados/i);
  assert.match(deletion, /Exclusão de Dados/i);
  assert.match(deletion, /Excluir sua conta SaintsAI/i);
  assert.match(deletion, /Solicitar exclusão/i);
  assert.match(deletion, /mailto:/i);
  assert.match(deletion, /Confirmaremos sua titularidade/i);
  assert.match(deletion, /número de WhatsApp/i);
});

test('app publica montagens estáticas sem autenticação para as páginas legais', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  assert.match(appSource, /app\.get\('\/politica-de-privacidade'/);
  assert.match(appSource, /app\.get\('\/exclusao-de-dados'/);
  assert.match(appSource, /app\.get\('\/privacy-policy\.html'/);
  assert.match(appSource, /app\.get\('\/robots\.txt'/);
});
