const municipios=require('./municipios-br');
const {CATEGORIAS}=require('./prospeccao.service');
const db=require('../config/supabase');
const owner=require('./ownerProspecting.service');
const fail=(message,status=503)=>Object.assign(Error(message),{status});
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function normalizar(place,categoria,cidade,uf){
 if(place.businessStatus!=='OPERATIONAL')return null;
 const parts=place.addressComponents||[];
 const city=parts.find(x=>x.types?.includes('administrative_area_level_2'))?.longText||parts.find(x=>x.types?.includes('locality'))?.longText;
 const state=parts.find(x=>x.types?.includes('administrative_area_level_1'))?.shortText;
 if(norm(city)!==norm(cidade)||state!==uf)return null;
 const telefone=String(place.internationalPhoneNumber||'').replace(/\D/g,'');
 if(!/^55\d{2}9\d{8}$/.test(telefone)||!place.id||!place.displayName?.text)return null;
 const avaliacoes=Math.max(0,Number(place.userRatingCount)||0),nota=Math.max(0,Math.min(5,Number(place.rating)||0));
 const score=Math.min(95,65+Math.min(20,Math.round(Math.log10(1+avaliacoes)*7))+Math.round(nota*2));
 return{id:'maps-'+place.id,nome:place.displayName.text,categoria:CATEGORIAS[categoria].label,endereco:place.formattedAddress||'',telefone,telefone_exibicao:place.internationalPhoneNumber,whatsapp:'https://wa.me/'+telefone,score,nivel:score>=84?'Alta prioridade':'Bom potencial',motivos:['WhatsApp confirmado na conexão da sua loja.','Atividade e avaliações públicas indicam potencial de atendimento.','Não é necessário ter site; a prioridade não confirma intenção de compra.'],avaliacoes,nota,origem:'Google Maps',atribuicoes:(place.attributions||[]).map(x=>String(x.provider||'')).filter(Boolean),automacao:'Não avaliada',site:''};
}
async function buscarProspeccao({uf,cidade,categoria,usuario,lojaId}){
 uf=String(uf||'').toUpperCase();cidade=String(cidade||'').trim().slice(0,80);categoria=String(categoria||'').toLowerCase();
 if(!CATEGORIAS[categoria])throw fail('Categoria inválida.',400);
 const city=municipios.find(x=>x[0]===uf&&norm(x[1])===norm(cidade));if(!city)throw fail('Cidade não encontrada. Confira o estado e a cidade.',400);
 const key=process.env.GOOGLE_MAPS_API_KEY;
 if(!key)throw fail('A busca integrada do Google Maps está pronta, mas falta configurar a chave Places API (New) no SaintsAI.',409);
 if(!usuario?.id||usuario.id!==process.env.SAINTSAI_OWNER_USER_ID)throw fail('Busca restrita ao dono.',403);
 if(!lojaId)throw fail('Selecione sua loja conectada por QR para confirmar os WhatsApps encontrados.',409);
 const {data:loja,error:el}=await db.from('lojas').select('dono_id').eq('id',lojaId).maybeSingle();if(el)throw fail('Não foi possível verificar sua loja.');if(loja?.dono_id!==usuario.id)throw fail('Escolha uma loja da sua própria conta.',403);
 const {data:cfg,error:ec}=await db.from('whatsapp_configuracoes').select('identificador_externo,provedor,numero_whatsapp').eq('loja_id',lojaId).eq('ativo',true).limit(2);if(ec)throw fail('Não foi possível verificar a conexão.');if(cfg?.length!==1||cfg[0].provedor!=='waha')throw fail('Conecte seu WhatsApp real por QR nesta loja para confirmar os contatos do Maps.',409);
 let data;try{const r=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.internationalPhoneNumber,places.businessStatus,places.rating,places.userRatingCount,places.attributions'},body:JSON.stringify({textQuery:CATEGORIAS[categoria].label+' em '+city[1]+' '+uf+' Brasil',languageCode:'pt-BR',regionCode:'BR',pageSize:20}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();data=await r.json();if(!Array.isArray(data.places))data.places=[];}catch{throw fail('O Google Maps não respondeu à consulta. Confira a chave, a API habilitada e o faturamento.');}
 const unique=new Map();for(const place of data.places){const lead=normalizar(place,categoria,city[1],uf);if(lead&&lead.telefone!==String(cfg[0].numero_whatsapp||'').replace(/\D/g,''))unique.set(lead.telefone,lead);}
 const candidatos=[...unique.values()].sort((a,b)=>b.score-a.score||a.nome.localeCompare(b.nome,'pt-BR')),leads=[];let unavailable=false;
 for(let i=0;i<candidatos.length&&leads.length<10;i+=4){const batch=await Promise.all(candidatos.slice(i,i+4).map(async lead=>{try{await owner.chatPorTelefone(cfg[0].identificador_externo,lead.telefone);return lead}catch(e){if(e.status!==400)unavailable=true;return null}}));leads.push(...batch.filter(Boolean));}
 if(unavailable)throw fail('Não foi possível confirmar os WhatsApps agora. Confira a conexão por QR e tente novamente.');
 return{origem:'Google Maps',local:city[1]+' / '+uf,categoria:CATEGORIAS[categoria].label,leads:leads.slice(0,10),aviso:'Até 10 contatos com WhatsApp confirmado, em ordem de potencial estimado por atividade e avaliações. Não representa probabilidade de compra.'};
}
module.exports={buscarProspeccao,normalizar};
