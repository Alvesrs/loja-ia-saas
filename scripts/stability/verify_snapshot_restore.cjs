// Private, local typed-data restore. Never logs rows, identifiers or SQL errors.
const fs = require('node:fs');
const { createRequire } = require('node:module');
const dependency = createRequire(process.env.SNAPSHOT_RUNTIME + '/package.json');
const { PGlite } = dependency('@electric-sql/pglite');
const q = x => '"' + x.replaceAll('"', '""') + '"';
const xmlText = x => x.match(/<document>([\s\S]*?)<\/document>/)[1].replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[e]));
(async () => {
  const snapshot = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const { btree_gist } = dependency('@electric-sql/pglite/contrib/btree_gist');
  const db = new PGlite({extensions:{btree_gist}});
  let phase = 'schemas', tables = 0, rows = 0, constraints = 0;
  try {
    await db.exec('CREATE EXTENSION btree_gist');
    for (const schema of ['auth','storage','extensions']) await db.exec(`CREATE SCHEMA ${q(schema)}`);
    for (const e of snapshot.enum_types) await db.exec(`CREATE TYPE ${q(e.schema)}.${q(e.name)} AS ENUM (${e.labels.map(v=>"'"+v.replaceAll("'","''")+"'").join(',')})`);
    phase = 'tables';
    for (const t of snapshot.tables) {
      await db.exec(`CREATE TABLE ${q(t.schema)}.${q(t.name)} (${t.columns.map(c=>`${q(c.name)} ${c.type}${c.generated ? ` GENERATED ALWAYS AS (${c.default}) STORED` : ''}${c.not_null ? ' NOT NULL' : ''}`).join(',')})`);
    }
    phase = 'rows';
    for (const t of snapshot.tables) {
      const name = `${q(t.schema)}.${q(t.name)}`, cols = t.columns.filter(c=>!c.generated).map(c=>q(c.name)).join(',');
      const raw = xmlText(t.data_xml);
      await db.query(`INSERT INTO ${name} (${cols}) SELECT ${cols} FROM jsonb_populate_recordset(NULL::${name}, $1::jsonb)`, [raw]);
      // Multiset comparison preserves duplicates; PostgreSQL compares typed values.
      const comparison = await db.query(`WITH expected AS (SELECT * FROM jsonb_populate_recordset(NULL::${name}, $1::jsonb)), difference AS ((SELECT to_jsonb(actual) FROM ${name} actual EXCEPT ALL SELECT to_jsonb(expected) FROM expected) UNION ALL (SELECT to_jsonb(expected) FROM expected EXCEPT ALL SELECT to_jsonb(actual) FROM ${name} actual)) SELECT count(*)::int AS n FROM difference`,[raw]);
      if(comparison.rows[0].n) throw Error('Mismatch');
      rows += (await db.query(`SELECT count(*)::int AS n FROM ${name}`)).rows[0].n;
      tables++;
    }
    phase = 'constraints';
    for (const c of [...snapshot.constraints].sort((a,b)=>Number(a.definition.startsWith('FOREIGN KEY'))-Number(b.definition.startsWith('FOREIGN KEY')))) {
      await db.exec(`ALTER TABLE ${q(c.schema)}.${q(c.table)} ADD CONSTRAINT ${q(c.name)} ${c.definition}`);
      constraints++;
    }
    const version = (await db.query('SHOW server_version')).rows[0].server_version;
    const report = {typed_data_restore_verified:true,tables,rows,constraints_verified:constraints,constraints_skipped:snapshot.constraints.length-constraints,source_version:snapshot.server_version,validation_version:version,scope:'Typed rows, generated values and constraints. Provider roles, functions, defaults, policies and Storage bytes are not restored by this check.'};
    fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n',{mode:0o600});
    console.log(JSON.stringify(report));
  } catch (_) { console.error(JSON.stringify({restore_verified:false,phase,tables,rows,constraints,error_code:_.code})); process.exitCode=1; }
  finally { await db.close(); }
})();
