const db=require('../config/supabase');
const auth=require('../config/supabaseAuth');
const {usuarioEhAdmin}=require('../middleware/admin');
const waha=require('./wahaOnboarding.service');
const fail=(message,status)=>Object.assign(new Error(message),{status});
async function excluir(lojaId,admin){
 if(!usuarioEhAdmin(admin))throw fail('Acesso restrito ao administrador.',403);
 const {data:loja,error}=await db.from('lojas').select('id,dono_id,nome').eq('id',lojaId).maybeSingle();
 if(error)throw fail('Não foi possível consultar o cliente.',503);
 if(!loja)throw fail('Cliente não encontrado.',404);
 const {data:user,error:ue}=await auth.auth.admin.getUserById(loja.dono_id);
 if(ue||!user?.user)throw fail('Não foi possível validar a conta do cliente.',503);
 if(usuarioEhAdmin(user.user))throw fail('A conta de administrador não pode ser excluída.',403);
 if(user.user.app_metadata?.saintsai_managed!==true)throw fail('Esta conta não é um cliente do SaintsAI.',403);
 // Stop the external session before deleting its database mapping.
 await waha.desconectar(loja.id);
 const {data:removed,error:de}=await db.rpc('saintsai_delete_client_store',{target_id:loja.id,expected_owner:loja.dono_id});
 if(de||!removed)throw fail('Não foi possível remover os dados do cliente. Tente novamente.',503);
 const {count,error:ce}=await db.from('lojas').select('id',{count:'exact',head:true}).eq('dono_id',loja.dono_id);
 if(ce)throw fail('Não foi possível concluir a exclusão da conta.',503);
 if(!count){const {error:ae}=await auth.auth.admin.deleteUser(loja.dono_id);if(ae)throw fail('Os dados foram removidos, mas a conta precisa de nova tentativa de exclusão.',503);}
 return {ok:true,excluido:true};
}
module.exports={excluir};
