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
  const source=fs.readFileSync('src/services/prospeccao.service.js','utf8');
  assert.match(source,/\.slice\(0,200\)/);
  assert.match(source,/padaria:\s*\{/);
});

test('cidades da prospecção estão disponíveis por estado e em ordem alfabética',()=>{
  const generator=fs.readFileSync('patches/maps-active-v2.js','utf8');
  if(!fs.existsSync('public/js/municipios-br.js')){
    assert.match(generator,/SAINTSAI_MUNICIPIOS/);
    assert.match(generator,/cidades-disponiveis/);
    return;
  }
  const page=fs.readFileSync('public/admin-prospeccao.html','utf8');
  assert.match(page,/id="cidade"[^>]*list="cidades-disponiveis"/);
  assert.match(page,/js\/municipios-br\.js\?v=/);
  const source=fs.readFileSync('public/js/municipios-br.js','utf8');
  const serialized=source.match(/window\.SAINTSAI_MUNICIPIOS=(.*);/);
  assert.ok(serialized,'lista de municípios gerada no build');
  const cities=JSON.parse(serialized[1]);
  const expected=require('../src/services/municipios-br');
  assert.equal(cities.length,expected.length);
  for(const uf of [...new Set(cities.map(x=>x[0]))]){
    const names=cities.filter(x=>x[0]===uf).map(x=>x[1]);
    for(let i=1;i<names.length;i++)assert.ok(names[i-1].localeCompare(names[i],'pt-BR',{sensitivity:'base'})<=0,`${uf}: ${names[i-1]} antes de ${names[i]}`);
  }
});

test('dashboard reúne quatro indicadores e prospecção com paginação persistente',()=>{
  const home=fs.readFileSync('public/admin-mobile.html','utf8');
  const inicio=home.indexOf('<section id="view-home"');
  const fim=home.indexOf('<section id="view-vendas"',inicio);
  assert.ok(inicio>=0&&fim>inicio);
  const painel=home.slice(inicio,fim);
  assert.equal((painel.match(/class="metric"/g)||[]).length,4);
  assert.match(painel,/id="home-prospecting"/);
  assert.doesNotMatch(home,/href="admin-prospeccao\.html"/);
  const script=fs.readFileSync('public/js/admin-home-prospecting.js','utf8');
  assert.match(script,/SAINTSAI_MUNICIPIOS/);
  assert.match(script,/localeCompare\(b,'pt-BR'/);
  assert.match(script,/data-hp-state/);
  assert.match(script,/nextPageToken/);
  assert.match(script,/nextOffset/);
  assert.match(script,/\['contatado','descartado'\]/);
});
