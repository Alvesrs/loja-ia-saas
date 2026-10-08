
const CATEGORIAS = Object.freeze({
  padaria: {label:'Padaria',base:76,motivo:'Dúvidas sobre produtos, encomendas e horários.',filtros:[['shop','bakery']]},
  barbearia: {
    label:'Barbearia',
    base:76,
    motivo:'Categoria com alta recorrência de dúvidas, preços e agendamentos.',
    filtros:[['shop','hairdresser']]
  },
  salao: {
    label:'Salão de beleza',
    base:78,
    motivo:'Categoria com alta recorrência, agenda e muitas dúvidas por WhatsApp.',
    filtros:[['shop','hairdresser'],['shop','beauty']]
  },
  tatuagem: {
    label:'Tatuagem',
    base:72,
    motivo:'Serviço que costuma exigir orçamento, agenda e troca de referências.',
    filtros:[['shop','tattoo']]
  },
  restaurante: {
    label:'Restaurante',
    base:80,
    motivo:'Categoria com alto volume potencial de dúvidas, pedidos, reservas e horários.',
    filtros:[['amenity','restaurant']]
  },
  clinica: {
    label:'Clínica',
    base:82,
    motivo:'Categoria com forte necessidade de triagem, horários e agendamentos.',
    filtros:[['amenity','clinic'],['amenity','doctors'],['amenity','dentist']]
  },
  oficina: {
    label:'Oficina',
    base:69,
    motivo:'Serviço com pedidos frequentes de orçamento, prazo e disponibilidade.',
    filtros:[['shop','car_repair']]
  },
  petshop: {
    label:'Pet shop',
    base:70,
    motivo:'Categoria com dúvidas recorrentes sobre produtos, banho/tosa e horários.',
    filtros:[['shop','pet'],['shop','pet_grooming']]
  },
  academia: {
    label:'Academia',
    base:68,
    motivo:'Categoria com alto volume de perguntas sobre planos, horários e matrícula.',
    filtros:[['leisure','fitness_centre']]
  }
});

function txt(v){return typeof v==='string'?v.trim():''}
function limparTelefone(v){
  const bruto=txt(v);
  if(!bruto) return '';
  const candidatos=bruto.split(/\s*(?:;|,|\||\bou\b)\s*/i).filter(Boolean);
  for(const candidato of candidatos){
    let d=candidato.replace(/\D/g,'');
    if(!d) continue;
    if(d.startsWith('0')&&d.length>11)d=d.replace(/^0+/,'');
    if((d.length===10||d.length===11)&&!d.startsWith('55')) d='55'+d;
    if((d.length===12||d.length===13)&&d.startsWith('55')) return d;
  }
  let d=bruto.replace(/\D/g,'');
  if((d.length===10||d.length===11)&&!d.startsWith('55')) d='55'+d;
  return (d.length===12||d.length===13)&&d.startsWith('55')?d:'';
}
function tag(t,...ks){for(const k of ks){const v=txt(t?.[k]); if(v) return v} return ''}

function scoreLead(tags,categoria){
  const cfg=CATEGORIAS[categoria]||CATEGORIAS.barbearia;
  let score=cfg.base;
  const phone=tag(tags,'contact:whatsapp','whatsapp','contact:phone','phone');
  const site=tag(tags,'website','contact:website');
  const instagram=tag(tags,'contact:instagram','instagram');
  const horario=tag(tags,'opening_hours');
  const brand=tag(tags,'brand');
  const email=tag(tags,'contact:email','email');

  if(phone) score+=8;
  if(horario) score+=5;
  if(site) score+=4;
  if(instagram) score+=3;
  if(email) score+=2;
  if(brand) score+=2;
  if(!phone&&!site&&!instagram) score-=12;
  if(!horario) score-=3;

  score=Math.max(25,Math.min(97,score));

  const motivos=[cfg.motivo];
  if(phone) motivos.push('Telefone ou WhatsApp público encontrado.');
  if(horario) motivos.push('Horário comercial cadastrado, sinal de operação organizada.');
  if(site||instagram) motivos.push('Presença digital pública identificada.');
  if(brand) motivos.push('Marca identificada nos dados públicos.');
  if(!phone&&!site&&!instagram) motivos.push('Poucos canais públicos encontrados; vale validar antes de abordar.');

  return {score,motivos};
}

async function fetchJson(url,options={},timeoutMs=12000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetch(url,{...options,signal:controller.signal,headers:{'user-agent':'SaintsAI-Prospec/1.0','accept':'application/json',...(options.headers||{})}});
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  }finally{clearTimeout(timer)}
}

const municipios=require('./municipios-br');
const normalize=v=>txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const resultCache=new Map(),inflight=new Map();
async function geocodificar(cidade,uf){
 const row=municipios.find(r=>r[0]===uf&&normalize(r[1])===normalize(cidade));
 if(!row)throw Error('Cidade não encontrada. Confira o nome e o estado.');
 const [,nome,lat,lon]=row;const dy=12/111,dx=12/(111*Math.cos(lat*Math.PI/180));
 return {south:lat-dy,north:lat+dy,west:lon-dx,east:lon+dx,nome:nome+' / '+uf};
}

function overpassQuery(bounds,categoria){
  const cfg=CATEGORIAS[categoria];
  const box=[bounds.south,bounds.west,bounds.north,bounds.east].join(',');
  const partes=[];
  for(const [k,v] of cfg.filtros){
    partes.push('nwr["'+k+'"="'+v+'"]('+box+');');
  }
  return '[out:json][timeout:10];('+partes.join('')+');out center tags;';
}

async function buscarOverpass(query){
  const endpoints=['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
  try{return await Promise.any(endpoints.map(ep=>fetchJson(ep+'?data='+encodeURIComponent(query),{},22000).then(data=>{if(!Array.isArray(data?.elements)||data.remark)throw Error('Resposta incompleta da fonte');return data;})));}
  catch(_){throw Error('A fonte pública de contatos está temporariamente indisponível. Tente novamente em alguns minutos.');}
}

function normalizarLead(el,categoria){
  const t=el?.tags||{};
  const nome=tag(t,'name','brand');
  if(!nome) return null;

  const phoneRaw=tag(t,'contact:whatsapp','whatsapp');
  const telefone=limparTelefone(phoneRaw);
  const site=tag(t,'website','contact:website');
  const instagram=tag(t,'contact:instagram','instagram');
  const horario=tag(t,'opening_hours');
  const endereco=[
    tag(t,'addr:street'),
    tag(t,'addr:housenumber'),
    tag(t,'addr:suburb')
  ].filter(Boolean).join(', ');
  const lat=Number(el.lat??el.center?.lat);
  const lon=Number(el.lon??el.center?.lon);
  const scored=scoreLead(t,categoria);

  return {
    id:String(el.type||'osm')+'-'+String(el.id||''),
    nome,
    categoria:CATEGORIAS[categoria].label,
    score:scored.score,
    nivel:scored.score>=84?'Alta prioridade':scored.score>=70?'Bom potencial':'Validar antes',
    motivos:scored.motivos.slice(0,4),
    telefone,
    telefone_exibicao:phoneRaw,
    whatsapp:telefone?'https://wa.me/'+telefone:'',
    site,
    instagram,
    horario,
    endereco,
    lat:Number.isFinite(lat)?lat:null,
    lon:Number.isFinite(lon)?lon:null,
    automacao:'Não identificada em dados públicos',
    automacao_confianca:'estimativa'
  };
}

async function consultar({uf,cidade,categoria}){
  uf=txt(uf).toUpperCase().slice(0,2);
  cidade=txt(cidade).slice(0,80);
  categoria=txt(categoria).toLowerCase();

  if(!uf||!cidade) throw new Error('Informe estado e cidade.');
  if(!CATEGORIAS[categoria]) throw new Error('Categoria inválida.');

  const bounds=await geocodificar(cidade,uf);
  const verified=require('./prospectos-verificados').filter(x=>x.uf===uf&&normalize(x.cidade)===normalize(cidade)&&x.categorias.includes(categoria)&&Date.now()-Date.parse(x.verificado_em)<90*86400000);
  const saved=verified.map(x=>({...normalizarLead({type:'publico',id:x.id,tags:{name:x.nome,'contact:whatsapp':x.telefone,website:x.fonte}},categoria),endereco:x.endereco,fonte:x.fonte,verificado_em:x.verificado_em}));
  if(saved.length)return {origem:'Contatos públicos verificados',local:bounds.nome,categoria:CATEGORIAS[categoria].label,leads:saved,aviso:'Contatos publicados pelas empresas; conferidos em 07/10/2026. Confira se o atendimento permanece ativo.'};
  const data=await buscarOverpass(overpassQuery(bounds,categoria));
  const leads=(Array.isArray(data?.elements)?data.elements:[])
    .map(x=>normalizarLead(x,categoria))
    .filter(x=>x&&x.whatsapp)
    .sort((a,b)=>b.score-a.score||a.nome.localeCompare(b.nome,'pt-BR'))
    .slice(0,50);

  return {
    origem:'OpenStreetMap/Overpass',
    local:bounds.nome,
    categoria:CATEGORIAS[categoria].label,
    aviso:'O score estima potencial comercial usando sinais públicos. Não mede mensagens reais e não confirma ausência de automação.',
    leads
  };
}

async function buscarProspeccao(args){const key=[txt(args.uf).toUpperCase(),normalize(args.cidade),txt(args.categoria).toLowerCase()].join('|');const old=resultCache.get(key);if(old&&Date.now()-old.time<600000)return old.value;if(inflight.has(key))return inflight.get(key);const work=consultar(args).then(value=>{if(resultCache.size>=100)resultCache.delete(resultCache.keys().next().value);resultCache.set(key,{time:Date.now(),value});return value;}).catch(e=>{if(old&&Date.now()-old.time<86400000)return {...old.value,cache:true,aviso:'Fonte temporariamente indisponível; exibindo a última consulta salva.'};throw e;}).finally(()=>inflight.delete(key));inflight.set(key,work);return work;}
module.exports={buscarProspeccao,scoreLead,CATEGORIAS};
