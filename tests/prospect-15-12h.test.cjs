'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require(process.env.PGLITE_TEST_MODULE||'@electric-sql/pglite');
test('15 slots, twelve-hour renewal, replay safety, store ownership and history preservation',async()=>{
 const db=new PGlite();try{
 await db.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid primary key);CREATE TABLE public.lojas(id uuid primary key,dono_id uuid);INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000001');INSERT INTO lojas VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');");
 await db.exec(fs.readFileSync('patches/assets/auto-prospect/schema.sql','utf8'));
 const migration=fs.readFileSync('sql/stability/prospect-15-12h.sql','utf8');await db.exec(migration);await db.exec(migration);
 const start="SELECT public.saintsai_prospect_start('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','{}') AS id";
 const first=(await db.query(start)).rows[0].id;
 assert.equal((await db.query(start)).rows[0].id,first);
 assert.equal((await db.query('SELECT limit_count FROM saintsai_prospect_batches')).rows[0].limit_count,15);
 await db.query("INSERT INTO saintsai_prospect_items(batch_id,loja_id,phone,contact,position,business,opening,status) SELECT $1,'00000000-0000-0000-0000-000000000002',n::text,n::text,n,'{}','synthetic','waiting' FROM generate_series(0,14) n",[first]);
 await db.exec("UPDATE saintsai_prospect_batches SET status='completed'");
 await assert.rejects(db.query(start),/12 horas/);
 await db.exec("UPDATE saintsai_prospect_batches SET created_at=now()-interval '12 hours'");
 const second=(await db.query(start)).rows[0].id;assert.notEqual(second,first);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM saintsai_prospect_items')).rows[0].n,15);
 await db.exec("UPDATE saintsai_prospect_batches SET created_at=now()-interval '13 hours';UPDATE saintsai_prospect_items SET status='uncertain' WHERE position=0");
 await assert.rejects(db.query(start),/não confirmado/);
 await db.exec("UPDATE saintsai_prospect_items SET status='waiting' WHERE position=0");
 await assert.rejects(db.query(start.replace('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000009')),/não pertence/);
 await db.query("INSERT INTO saintsai_prospect_items(batch_id,loja_id,phone,contact,position,business,opening) VALUES($1,'00000000-0000-0000-0000-000000000002','new','new',0,'{}','synthetic')",[second]);
 await db.query(start);assert.equal((await db.query("SELECT status FROM saintsai_prospect_items WHERE phone='new'")).rows[0].status,'cancelled');
 const perms=(await db.query("SELECT has_function_privilege('anon','public.saintsai_prospect_start(uuid,uuid,jsonb)','execute') AS anon,has_function_privilege('authenticated','public.saintsai_prospect_start(uuid,uuid,jsonb)','execute') AS authenticated")).rows[0];assert.equal(perms.anon,false);assert.equal(perms.authenticated,false);
 }finally{await db.close();}
});
test('fallback generates fifteen valid openings even with repeated randomness',()=>{const rules=require('../src/services/autoProspect.rules');const texts=rules.variedOpenings(Array.from({length:15},(_,i)=>({nome:'Empresa '+i})),[],()=>0);assert.equal(texts.length,15);for(const t of texts)assert(rules.openingQuality(t));});
