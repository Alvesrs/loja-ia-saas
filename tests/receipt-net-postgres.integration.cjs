'use strict';const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
if(process.env.SAINTSAI_ISOLATED_POSTGRES!=='1'||process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!=='saintsai_stability_test')throw Error('Receipt migration requires isolated CI Postgres');
const sql=s=>execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-c',s],{timeout:10000,encoding:'utf8'}).trim();
test('nullable receipt migration is repeatable and preserves existing booking prices',()=>{
 sql('CREATE TABLE public.saintsai_agendamentos(id integer primary key,valor numeric(12,2));INSERT INTO public.saintsai_agendamentos VALUES(1,30);');
 const migration=fs.readFileSync('sql/stability/receipt-net-value.sql','utf8');sql(migration);sql(migration);
 assert.equal(sql('SELECT valor::text||\'|\'||coalesce(pagamento_valor_liquido::text,\'NULL\') FROM public.saintsai_agendamentos WHERE id=1;'),'30.00|NULL');
 sql('UPDATE public.saintsai_agendamentos SET pagamento_valor_liquido=27 WHERE id=1;');
 assert.equal(sql('SELECT valor::text||\'|\'||pagamento_valor_liquido::text FROM public.saintsai_agendamentos WHERE id=1;'),'30.00|27.00');
});
