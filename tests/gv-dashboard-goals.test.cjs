const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function setup(){
 const routes={},queries=[],writes=[];let calls=0;
 const rows=[{id:'1',cliente_id:'a',valor:100,observacao:'[CLIENTE_TIPO]novo',vendido_em:'2026-01-10'}, {id:'2',cliente_id:'a',valor:200,observacao:'[CLIENTE_TIPO]recorrente',vendido_em:'2026-01-11'}];
 const db={from(table){const q={table,filters:[]};queries.push(q);let data=table==='gv_metas'?{valor:1000}:(calls++===0?rows:[]);const b={select(cols){q.cols=cols;return b},eq(k,v){q.filters.push([k,v]);return b},gte(){return b},lt(){return b},maybeSingle(){return Promise.resolve({data})},upsert(value){writes.push(value);return Promise.resolve({error:null})},then(resolve){return Promise.resolve({data}).then(resolve)}};return b}};
 const router={get(p,...h){routes['GET '+p]=h.at(-1)},put(p,...h){routes['PUT '+p]=h.at(-1)},post(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../sales-manager-runtime/sales-manager.routes.js'),'utf8'),{require:n=>n==='express'?{Router:()=>router}:{createClient:()=>db},process:{env:{SUPABASE_URL:'test',SUPABASE_SERVICE_ROLE_KEY:'test'}},console,Intl,Date,module:{exports:{}}});
 const req={query:{mes:'2026-01'},gv:{empresa:{id:'company-a'}}},res={status(n){this.code=n;return this},json(d){this.body=d}};
 return {routes,queries,writes,req,res};
}
test('dashboard reads saved recurrence and keeps unique clients distinct from sales',async()=>{const t=setup();await t.routes['GET /dashboard'](t.req,t.res);assert.equal(t.res.body.tipos_clientes.recorrente,1);assert.equal(t.res.body.metricas.clientes,1);assert.equal(t.res.body.metricas.vendas,2);assert.equal(t.res.body.meta_mensal,1000);assert.ok(t.queries[0].cols.includes('observacao'));assert.ok(t.queries.every(q=>q.filters.some(([k,v])=>k==='empresa_id'&&v==='company-a')))});
test('goal writes use authenticated company and validate negative amounts',async()=>{const t=setup();t.req.body={mes:'2026-01',valor:5000,empresa_id:'other'};await t.routes['PUT /meta'](t.req,t.res);assert.equal(t.writes[0].empresa_id,'company-a');assert.equal(t.writes[0].valor,5000);t.req.body.valor=-1;await t.routes['PUT /meta'](t.req,t.res);assert.equal(t.res.code,400);assert.equal(t.writes.length,1)});
