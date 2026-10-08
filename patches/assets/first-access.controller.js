const db=require('../config/supabase');
const {createClient}=require('@supabase/supabase-js');
const {emailsAdmin}=require('../middleware/admin');
const client=()=>createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
function pending(user){return user?.app_metadata?.saintsai_first_access===true;}
async function status(req,res){res.set('Cache-Control','no-store');res.json({obrigatorio:pending(req.usuario)});}
async function concluir(req,res){
 res.set('Cache-Control','no-store');
 if(!pending(req.usuario))return res.status(409).json({erro:'Seu primeiro acesso já foi concluído.'});
 const email=String(req.body?.email||'').trim().toLowerCase(),senha=req.body?.senha,temporaria=req.body?.senha_temporaria;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||email.endsWith('.invalid')||emailsAdmin().includes(email))return res.status(400).json({erro:'Informe seu e-mail pessoal ou profissional válido.'});
 if(email===req.usuario.email.toLowerCase())return res.status(400).json({erro:'Troque o e-mail temporário pelo seu e-mail.'});
 if(typeof senha!=='string'||senha.length<10||senha.length>128||senha===temporaria)return res.status(400).json({erro:'Escolha uma nova senha com pelo menos 10 caracteres.'});
 if(typeof temporaria!=='string'||temporaria.length>128)return res.status(400).json({erro:'Informe a senha temporária que você recebeu.'});
 try{
  const auth=client();
  const checked=await auth.auth.signInWithPassword({email:req.usuario.email,password:temporaria});
  if(checked.error||checked.data?.user?.id!==req.usuario.id)return res.status(403).json({erro:'A senha temporária não confere.'});
  const revoked=await db.auth.admin.signOut(req.headers.authorization.slice(7),'global');
  if(revoked.error)return res.status(503).json({erro:'Não foi possível proteger seu novo acesso. Tente novamente em instantes.'});
  const floor=Math.floor(Date.now()/1000)+1;
  const changed=await db.auth.admin.updateUserById(req.usuario.id,{email,password:senha,email_confirm:true,app_metadata:{...req.usuario.app_metadata,saintsai_first_access:false,saintsai_credentials_after:floor}});
  if(changed.error)return res.status(changed.error.status>=500?503:400).json({erro:'Não foi possível trocar os dados. Confira se o e-mail já possui uma conta.'});
  // Every API request checks the trusted epoch, even when an old access JWT has not expired.
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,floor*1000-Date.now()+30)));
  const signed=await client().auth.signInWithPassword({email,password:senha});
  if(signed.error||!signed.data?.session)return res.json({ok:true,entrar_novamente:true});
  const {user,session}=signed.data;
  return res.json({ok:true,usuario:user,token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at});
 }catch(_){return res.status(503).json({erro:'Não foi possível finalizar agora. Se os dados já foram alterados, entre com seu novo e-mail e senha.'});}
}
module.exports={status,concluir,pending};
