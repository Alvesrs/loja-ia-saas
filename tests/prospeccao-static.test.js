const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('prospecção tem página, rota e ranking',()=>{
  assert.equal(fs.existsSync('public/admin-prospeccao.html'),true);
  const page=fs.readFileSync('public/admin-prospeccao.html','utf8');
  assert.match(page,/Buscar clientes|Buscar no Maps|Buscar no mapa|Buscar comércios/);
  assert.match(page,/Automação não identificada|automacao/);
  const routes=fs.readFileSync('src/routes/admin.routes.js','utf8');
  assert.match(routes,/prospeccao\/buscar/);
  const service=require('../src/services/prospeccao.service');
  const forte=service.scoreLead({phone:'+55 43 99999-9999',opening_hours:'Mo-Fr 08:00-18:00',website:'https://exemplo.com'},'barbearia');
  const fraco=service.scoreLead({},'barbearia');
  assert.ok(forte.score>fraco.score);
  assert.ok(forte.score<=97);
});
