-- Read-only application database snapshot through the existing Supabase connector.
-- Data and the manifest travel encrypted. Storage object bytes need a separate backup.
WITH snapshot_key AS MATERIALIZED (
 SELECT encode(extensions.gen_random_bytes(32),'hex') AS password
), snapshot AS MATERIALIZED (
 SELECT jsonb_build_object(
  'format','saintsai-logical-snapshot-v1',
  'created_at',transaction_timestamp(),
  'server_version',current_setting('server_version'),
  'mvcc_snapshot',txid_current_snapshot()::text,
  'tables',(SELECT coalesce(jsonb_agg(jsonb_build_object(
   'schema',n.nspname,'name',c.relname,'kind',c.relkind,
   'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
   'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,
   'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
   'data_xml',query_to_xml(format('SELECT coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb)::text AS document FROM ONLY %I.%I AS t',n.nspname,c.relname),true,false,'')::text
  ) ORDER BY n.nspname,c.relname),'[]'::jsonb) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','storage') AND c.relkind IN ('r','p')),
  'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',k.conname,'definition',pg_get_constraintdef(k.oid,true))),'[]'::jsonb) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','storage')),
  'indexes',(SELECT coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) FROM pg_indexes i WHERE schemaname IN ('public','auth','storage')),
  'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) FROM pg_policies p WHERE schemaname IN ('public','auth','storage')),
  'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'definition',pg_get_functiondef(p.oid))),'[]'::jsonb) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','auth','storage') AND p.prokind IN ('f','p')),
  'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled)),'[]'::jsonb) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','storage') AND NOT t.tgisinternal),
  'views',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'definition',pg_get_viewdef(c.oid,true))),'[]'::jsonb) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','storage') AND c.relkind IN ('v','m')),
  'sequences',(SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) FROM pg_sequences s WHERE schemaname IN ('public','auth','storage')),
  'enum_types',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',t.typname,'labels',(SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid))),'[]'::jsonb) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('public','auth','storage') AND t.typtype='e'),
  'extensions',(SELECT jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname)) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace)
 )::text AS document
)
SELECT encode(extensions.pgp_sym_encrypt(document,password,'cipher-algo=aes256,compress-algo=1'),'base64') AS encrypted_snapshot,
 password AS transport_key,
 encode(extensions.digest(document,'sha256'),'hex') AS plaintext_sha256
FROM snapshot CROSS JOIN snapshot_key;
