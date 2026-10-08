const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');

test('início prioriza lucro e contém prospecção abaixo dos indicadores em faixa horizontal',()=>{
 const html=fs.readFileSync('public/admin-mobile.html','utf8');
 const home=html.slice(html.indexOf('id="view-home"'),html.indexOf('id="view-vendas"'));
 assert(home.indexOf('Lucro hoje')<home.indexOf('Faturamento hoje'));
 assert(home.indexOf('class="metricGrid"')<home.indexOf('id="home-prospecting"'));
 assert(home.indexOf('id="home-prospecting"')<home.indexOf('id="mClientes"'));
 assert.match(html,/\.home-prospect-strip\{display:flex;[^}]*overflow-x:auto/);
 assert.match(home,/Atualizar opções/);
 assert.match(home,/id="homeProsStore"/);
});

test('prospecção marca contatos localmente e busca por cursor sem repetir lote',()=>{
 const js=fs.readFileSync('public/js/home-prospecting.js','utf8');
 assert.match(js,/saintsai-prospeccao-v1/);
 assert.match(js,/contatado/);
 assert.match(js,/q\.set\('pageToken',token\)/);
 assert.match(js,/offset:String\(offset\)/);
 assert.match(js,/homeProsRefresh/);
 assert.match(js,/sort\(\(a,b\)=>a\.localeCompare\(b,'pt-BR'/);
});

test('prospecção não fica como opção separada na navegação inferior ou no menu',()=>{
 const js=fs.readFileSync('public/js/saintsai-remake.js','utf8');
 assert.match(js,/\['Vendas','radar','vendas'\]/);
 assert.match(js,/if\(prospect\)prospect\.remove\(\)/);
});
