// One-time maintenance explicitly requested by the owner: only SaintsAI client
// accounts, never administrators or accounts of the separate sales manager.
module.exports=async function verifyAndClean(){
 const db=require('../src/config/supabase'),auth=require('../src/config/supabaseAuth');
 const {createClient}=require('@supabase/supabase-js');
 const {usuarioEhAdmin}=require('../src/middleware/admin');
 const waha=require('../src/services/wahaOnboarding.service');
 const marker='owner-authorized-client-cleanup-20261007-v1';
 const {data:done,error:me}=await db.from('whatsapp_eventos_processados').select('id_externo').eq('provedor','manutencao').eq('id_externo',marker).maybeSingle();if(me)throw me;if(done)return;
 const owner=process.env.SAINTSAI_OWNER_USER_ID;
 const {data:root,error:re}=await auth.auth.admin.getUserById(owner);if(re||!usuarioEhAdmin(root?.user))throw Error('ADM não validado; exclusão bloqueada');
 const {data:stores,error:se}=await db.from('lojas').select('id,nome,dono_id').eq('dono_id',owner);if(se)throw se;
 let jwt=null,fixtureUser=null;
 const temp=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 async function http(path,method='GET',token=jwt){const r=await fetch('http://127.0.0.1:'+process.env.PORT+'/api'+path,{method,headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(35000)});let body;try{body=await r.json()}catch{body={}}return {status:r.status,body};}
 try{
  // generateLink does not send email; the temporary session is revoked locally.
  const {data:link,error:le}=await auth.auth.admin.generateLink({type:'magiclink',email:root.user.email});if(le)throw le;
  const {data:session,error:ve}=await temp.auth.verifyOtp({type:'magiclink',token_hash:link.properties.hashed_token});if(ve)throw ve;jwt=session.session.access_token;
  if((await http('/admin/me')).body.admin!==true)throw Error('API ADM falhou');
  const protectedStore=stores[0];if(!protectedStore)throw Error('Loja ADM ausente');
  if((await http('/admin/clientes-gerenciados/'+protectedStore.id,'DELETE')).status!==403)throw Error('Proteção ADM falhou');
  console.log('[repair.live] ADM protegido');
  const clients=await http('/admin/clientes-gerenciados');if(clients.status!==200)throw Error('Listagem clientes falhou');
  const targetIds=['ebc5cd37-ae67-4192-9909-d262d50ac92d','b3c9426f-444c-4edf-8dd0-e6dc0b8c98c0','331eced9-89a5-4494-8b4d-1e2d14eafa3c'];
  const {data:targets,error:te}=await db.from('lojas').select('id,nome,dono_id').in('dono_id',targetIds);if(te)throw te;
  // Check real already-paired sessions before performing the requested cleanup.
  for(const loja of targets){const st=await waha.status(loja.id);if(st.connected&&st.verified){const response=await http('/lojas/'+loja.id+'/cliente-hub/whatsapp/status');if(response.status!==200||!response.body.conectado||!response.body.verificado)throw Error('Status de conexão real falhou');let number=st.numero;if(/^55\d{2}[6-9]\d{7}$/.test(number))number=number.slice(0,4)+'9'+number.slice(4);const pair=await waha.iniciarPareamento(loja.id,number);if(!pair.already_connected)throw Error('Reconhecimento do nono dígito falhou');console.log('[repair.live] conexão real reconhecida; nono dígito validado');}}
  const {data:newUser,error:ne}=await auth.auth.admin.createUser({email:'saintsai-repair-'+require('node:crypto').randomUUID()+'@example.invalid',password:require('node:crypto').randomBytes(24).toString('hex'),email_confirm:true,app_metadata:{saintsai_managed:true}});if(ne)throw ne;fixtureUser=newUser.user.id;
  const {data:fixture,error:fe}=await db.from('lojas').insert({nome:'Validação temporária de exclusão',dono_id:fixtureUser}).select('id').single();if(fe)throw fe;
  const removed=await http('/admin/clientes-gerenciados/'+fixture.id,'DELETE');if(removed.status!==200||!removed.body.excluido)throw Error('Exclusão HTTP real falhou: '+(removed.body.erro||removed.status));
  const {data:gone}=await auth.auth.admin.getUserById(fixtureUser);if(gone?.user)throw Error('Conta temporária ainda existe');fixtureUser=null;
  console.log('[repair.live] criação e exclusão HTTP reais verificadas');
  const prospect=await http('/admin/prospeccao/buscar?cidade=Maring%C3%A1&uf=PR&categoria=Barbearia');if(prospect.status!==200||!prospect.body.leads?.length||prospect.body.leads.some(l=>!/^https:\/\/wa.me\/55\d{10,11}$/.test(l.whatsapp)))throw Error('Busca real sem links válidos');console.log('[repair.live] busca real com links WhatsApp válidos: '+prospect.body.leads.length);
  for(const loja of targets){const result=await http('/admin/clientes-gerenciados/'+loja.id,'DELETE');if(result.status!==200||!result.body.excluido)throw Error('Exclusão solicitada falhou: '+loja.nome+' '+(result.body.erro||result.status));console.log('[repair.cleanup] cliente excluído: '+loja.nome);}
  for(const id of targetIds){const {data:u,error:e}=await auth.auth.admin.getUserById(id);if(u?.user){if(usuarioEhAdmin(u.user)||u.user.app_metadata?.saintsai_managed!==true)throw Error('Conta protegida encontrada na seleção');const {count,error:c}=await db.from('lojas').select('id',{head:true,count:'exact'}).eq('dono_id',id);if(c||count)throw Error('Loja do cliente ainda existe');const {error:d}=await auth.auth.admin.deleteUser(id);if(d)throw d;}}
  const {data:after,error:aerr}=await db.from('lojas').select('id').eq('dono_id',owner);if(aerr||after.length!==stores.length)throw Error('Lojas ADM alteradas');
  if((await http('/admin/me')).body.admin!==true)throw Error('ADM deixou de acessar após limpeza');
  const listed=await http('/admin/clientes-gerenciados');if(listed.status!==200||listed.body.length)throw Error('Listagem não está vazia após limpeza');
  const {error:mark}=await db.from('whatsapp_eventos_processados').insert({provedor:'manutencao',id_externo:marker,status:'concluido',processado_em:new Date().toISOString()});if(mark)throw mark;
  console.log('[repair.live] CONCLUIDO: clientes removidos, ADM preservado e APIs verificadas');
 }finally{if(fixtureUser)await auth.auth.admin.deleteUser(fixtureUser);if(jwt)await auth.auth.admin.signOut(jwt,'local');}
};
