const source=require('./prospeccao.service');
const db=require('../config/supabase');
const owner=require('./ownerProspecting.service');
async function buscarProspeccao(args){
 const offset=Math.max(0,Number.isInteger(Number(args.offset))?Number(args.offset):0),limit=10;
 let session=null;
 if(args.lojaId){const {data:l,error}=await db.from('lojas').select('dono_id').eq('id',args.lojaId).maybeSingle();if(error)throw Error('Não foi possível consultar sua loja.');if(l?.dono_id!==args.usuario?.id)throw Object.assign(Error('Escolha uma loja da sua própria conta.'),{status:403});const {data:c,error:ec}=await db.from('whatsapp_configuracoes').select('provedor,identificador_externo').eq('loja_id',args.lojaId).eq('ativo',true).limit(2);if(ec)throw Error('Não foi possível consultar sua conexão.');if(c?.length===1&&c[0].provedor==='waha')session=c[0].identificador_externo;}
 const result=await source.buscarProspeccao(args),unique=new Map();for(const lead of result.leads||[])if(/^55\d{10,11}$/.test(lead.telefone||''))unique.set(lead.telefone,lead);
 const ordered=[...unique.values()].sort((a,b)=>b.score-a.score||a.nome.localeCompare(b.nome,'pt-BR')),leads=[];let unavailable=false,cursor=offset;
 for(;cursor<ordered.length&&leads.length<limit;cursor+=4){const batch=await Promise.all(ordered.slice(i,i+4).map(async lead=>{if(!session)return lead.whatsapp_publicado||lead.fonte?{...lead,whatsapp_status:'Publicado pela empresa'}:null;try{await owner.chatPorTelefone(session,lead.telefone);return{...lead,whatsapp_status:'Confirmado na sua conexão'}}catch(e){if(e.status!==400){unavailable=true;if(lead.whatsapp_publicado||lead.fonte)return{...lead,whatsapp_status:'Publicado; confirmação indisponível agora'};}return null}}));leads.push(...batch.filter(Boolean));}
 return{...result,origem:'OpenStreetMap e contatos públicos',leads:leads.slice(0,limit),nextOffset:cursor<ordered.length?cursor:null,hasMore:cursor<ordered.length,aviso:'Até 10 opções por potencial estimado. '+(session?(unavailable?'Alguns WhatsApps publicados não puderam ser confirmados agora.':'WhatsApps verificados na sua conexão.'):'Sem conexão por QR, mostramos apenas WhatsApps publicados pelas empresas.')+' A cobertura depende dos cadastros disponíveis.'};
}
module.exports={buscarProspeccao};
