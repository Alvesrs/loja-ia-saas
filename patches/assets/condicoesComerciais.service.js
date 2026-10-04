const db=require('../config/supabase');
const {obterPlano,listarPlanos}=require('../config/planos');
function validar(x){
 if(!x||typeof x!=='object'||!obterPlano(x.plano)?.vendavel)throw new Error('condicao_invalida');
 if(!['publico','personalizado'].includes(x.tipo))throw new Error('condicao_invalida');
 if(x.tipo==='personalizado'&&(!Number.isSafeInteger(x.preco_mensal_centavos)||x.preco_mensal_centavos<1||x.preco_mensal_centavos>100000000))throw new Error('condicao_invalida');
 return {tipo:x.tipo,plano:x.plano,preco_mensal_centavos:x.preco_mensal_centavos};
}
async function obter(lojaId){const {data,error}=await db.from('saintsai_condicoes_comerciais').select('plano,preco_mensal_centavos,atualizado_em').eq('loja_id',lojaId).maybeSingle();if(error)throw error;return data||null;}
function aplicar(p,c){return p?{...p,precoPersonalizado:Boolean(c&&c.plano===p.codigo),precoMensalCentavos:c&&c.plano===p.codigo?c.preco_mensal_centavos:p.precoMensalCentavos}:null;}
async function listar(lojaId){const c=await obter(lojaId);return listarPlanos().map(p=>aplicar(p,c));}
async function planoParaLoja(lojaId,codigo){return aplicar(obterPlano(codigo),await obter(lojaId));}
async function salvar(lojaId,entrada,adminId){const x=validar(entrada);const q=x.tipo==='publico'?db.from('saintsai_condicoes_comerciais').delete().eq('loja_id',lojaId):db.from('saintsai_condicoes_comerciais').upsert({loja_id:lojaId,plano:x.plano,preco_mensal_centavos:x.preco_mensal_centavos,definido_por:adminId,atualizado_em:new Date().toISOString()},{onConflict:'loja_id'});const {error}=await q;if(error)throw error;return obter(lojaId);}
function cadastro(x){const condicao=validar(x);if(typeof x.ativar!=='boolean'||![1,3,6,12].includes(x.duracao_meses))throw new Error('condicao_invalida');return {...condicao,ativar:x.ativar,duracao_meses:x.duracao_meses};}
function validade(meses,agora=new Date()){const d=new Date(agora);const dia=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+meses);const fim=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(dia,fim));return d.toISOString();}
module.exports={validar,cadastro,obter,aplicar,listar,planoParaLoja,salvar,validade};
