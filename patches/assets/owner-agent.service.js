const db=require('../config/supabase');
const EMAIL='pealves434@gmail.com';
const fail=(message,status=403)=>Object.assign(Error(message),{status});
function authorized(user){return Boolean(process.env.SAINTSAI_OWNER_USER_ID&&user?.id===process.env.SAINTSAI_OWNER_USER_ID&&String(user.email||'').trim().toLowerCase()===EMAIL);}
async function status(user){
 if(!authorized(user))return {disponivel:false};
 const {data,error}=await db.from('lojas').select('id,nome,modo_vendedor_somente').eq('dono_id',user.id);if(error)throw error;
 const billing=require('./asaas.service'),sales=require('./ownerSalesOnboarding.service');
 return {disponivel:true,lojas:data||[],pagamento_pronto:billing.configurado()&&billing.webhookConfigurado()&&billing.ambiente()==='production',planos:sales.available().map(p=>({codigo:p.codigo,nome:p.nome,valor_centavos:p.precoMensalCentavos})),teste:require('./ownerSellerTest.service').info(user),botoes:{meta:'Botões e listas pela conexão oficial; dependem das regras da Meta.',waha:'Na conexão por QR a entrega de botões não é garantida. As opções numeradas funcionam por texto.'}};
}
async function activate(user,{lojaId,ativo}={}){
 if(!authorized(user))throw fail('Acesso restrito ao dono.');if(typeof ativo!=='boolean')throw fail('Escolha ativar ou desativar.',400);
 const {data,error}=await db.from('lojas').update({modo_vendedor_somente:ativo}).eq('id',lojaId).eq('dono_id',user.id).select('id,nome,modo_vendedor_somente').maybeSingle();if(error)throw error;if(!data)throw fail('Escolha uma loja da sua conta.');
 return {ok:true,loja:data};
}
module.exports={authorized,status,activate};
