const fs=require('node:fs');

function read(p){return fs.readFileSync(p,'utf8')}
function write(p,v){fs.writeFileSync(p,v)}
function ensureDir(p){fs.mkdirSync(p,{recursive:true})}

ensureDir('src/services');

const service = String.raw`
const CATEGORIAS = Object.freeze({
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
  let d=txt(v).replace(/\\D/g,'');
  if(!d) return '';
  if((d.length===10||d.length===11)&&!d.startsWith('55')) d='55'+d;
  return d.length>=12&&d.length<=13?d:'';
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

async function geocodificar(cidade,uf){
  const q=encodeURIComponent([cidade,uf,'Brasil'].filter(Boolean).join(', '));
  const url='https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=br&limit=1&addressdetails=1&q='+q;
  const data=await fetchJson(url,{},10000);
  const item=Array.isArray(data)?data[0]:null;
  if(!item?.boundingbox) throw new Error('Cidade não encontrada.');
  const b=item.boundingbox.map(Number);
  return {south:b[0],north:b[1],west:b[2],east:b[3],nome:item.display_name||cidade};
}

function overpassQuery(bounds,categoria){
  const cfg=CATEGORIAS[categoria];
  const box=[bounds.south,bounds.west,bounds.north,bounds.east].join(',');
  const partes=[];
  for(const [k,v] of cfg.filtros){
    partes.push('nwr["'+k+'"="'+v+'"]('+box+');');
  }
  return '[out:json][timeout:20];('+partes.join('')+');out center tags 80;';
}

async function buscarOverpass(query){
  const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
  let ultimo;
  for(const ep of endpoints){
    try{
      return await fetchJson(ep,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(query)},22000);
    }catch(e){ultimo=e}
  }
  throw ultimo||new Error('Busca indisponível.');
}

function normalizarLead(el,categoria){
  const t=el?.tags||{};
  const nome=tag(t,'name','brand');
  if(!nome) return null;

  const phoneRaw=tag(t,'contact:whatsapp','whatsapp','contact:phone','phone');
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

async function buscarProspeccao({uf,cidade,categoria}){
  uf=txt(uf).toUpperCase().slice(0,2);
  cidade=txt(cidade).slice(0,80);
  categoria=txt(categoria).toLowerCase();

  if(!uf||!cidade) throw new Error('Informe estado e cidade.');
  if(!CATEGORIAS[categoria]) throw new Error('Categoria inválida.');

  const bounds=await geocodificar(cidade,uf);
  const data=await buscarOverpass(overpassQuery(bounds,categoria));
  const leads=(Array.isArray(data?.elements)?data.elements:[])
    .map(x=>normalizarLead(x,categoria))
    .filter(Boolean)
    .sort((a,b)=>(Number(Boolean(b.whatsapp))-Number(Boolean(a.whatsapp)))||b.score-a.score||a.nome.localeCompare(b.nome,'pt-BR'))
    .slice(0,50);

  return {
    origem:'OpenStreetMap/Overpass',
    local:bounds.nome,
    categoria:CATEGORIAS[categoria].label,
    aviso:'O score estima potencial comercial usando sinais públicos. Não mede mensagens reais e não confirma ausência de automação.',
    leads
  };
}

module.exports={buscarProspeccao,scoreLead,CATEGORIAS};
`;
write('src/services/prospeccao.service.js',service);

let controller=read('src/controllers/admin.controller.js');
if(!controller.includes('async function buscarProspeccao')){
  const fn=String.raw`
async function buscarProspeccao(req,res){
  try{
    const service=require('../services/prospeccao.service');
    const resultado=await service.buscarProspeccao({
      uf:req.query?.uf,
      cidade:req.query?.cidade,
      categoria:req.query?.categoria
    });
    return res.json(resultado);
  }catch(erro){
    const mensagem=String(erro?.message||'Não foi possível buscar empresas.');
    const status=/Informe estado|Categoria inválida|Cidade não encontrada/.test(mensagem)?400:502;
    return res.status(status).json({erro:mensagem});
  }
}
`;
  controller=controller.replace('\nasync function operacao(req, res) {',fn+'\nasync function operacao(req, res) {');
  controller=controller.replace(/module\.exports\s*=\s*\{([^}]+)\};/, (m,inner)=>{
    const nomes=inner.split(',').map(x=>x.trim()).filter(Boolean);
    if(!nomes.includes('buscarProspeccao')) nomes.push('buscarProspeccao');
    return 'module.exports = { '+nomes.join(', ')+' };';
  });
}
write('src/controllers/admin.controller.js',controller);

let routes=read('src/routes/admin.routes.js');
if(!routes.includes("'/prospeccao/buscar'")){
  routes=routes.replace(
    'module.exports = router;',
    "router.get('/prospeccao/buscar', exigirAdmin, controller.buscarProspeccao);\n\nmodule.exports = router;"
  );
}
write('src/routes/admin.routes.js',routes);

const page=String.raw`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b0b10">
<title>SaintsAI · Prospecção</title>
<script src="js/config.js"></script>
<script src="js/auth.js"></script>
<script src="js/api.js"></script>
<style>
:root{--bg:#0b0b10;--panel:#121219;--line:#2b2933;--txt:#f4f1f8;--muted:#aaa4b4;--p:#a88be8;--ok:#8fe0ad;--warn:#f0cf7c}
*{box-sizing:border-box}html,body{max-width:100%;overflow-x:hidden}body{margin:0;background:var(--bg);color:var(--txt);font:14px Inter,Arial,sans-serif}
main{max-width:980px;margin:auto;padding:calc(18px + env(safe-area-inset-top)) 16px 80px}
.top{display:flex;align-items:center;gap:14px;margin-bottom:18px}.back{color:#cab9ef;text-decoration:none;font-weight:700}
h1{font-size:28px;letter-spacing:-.7px;margin:0}.sub{color:var(--muted);line-height:1.5;margin:6px 0 0}
.filters{display:grid;grid-template-columns:minmax(96px,120px) minmax(0,1fr) minmax(0,1fr) minmax(150px,auto);gap:10px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;overflow:visible;max-width:100%}
label{display:grid;gap:6px;color:#c8c2cf;font-size:12px;min-width:0}select,input{width:100%;min-width:0;min-height:46px;border:1px solid #3a3743;border-radius:6px;background:#0e0e14;color:#fff;padding:0 12px;font:inherit;outline:none;line-height:1.2;appearance:auto}
button{min-height:44px;border:0;border-radius:6px;padding:0 15px;font:inherit;font-weight:800;cursor:pointer;white-space:normal}.primary{background:var(--p);color:#171020;align-self:end;width:100%}
.tools{display:flex;gap:8px;align-items:center;justify-content:space-between;margin:16px 0 10px}.status{color:var(--muted);font-size:12px}
.cards{display:grid;gap:10px;min-width:0}.card{border:1px solid var(--line);background:#111118;border-radius:10px;padding:15px;min-width:0;overflow:hidden}
.head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.name{font-size:17px;font-weight:850}.score{font-size:21px;font-weight:900}.score small{display:block;font-size:10px;color:var(--muted);font-weight:650;text-align:right}
.badges{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0}.badge{border:1px solid #3c3748;border-radius:5px;padding:5px 7px;font-size:10px;color:#d7cde5}.high{color:var(--ok);border-color:#31553e}.mid{color:var(--warn);border-color:#5b5032}
.meta{display:grid;gap:5px;color:#b9b3c0;font-size:12px;line-height:1.5;overflow-wrap:anywhere}.why{margin:12px 0 0;padding-left:18px;color:#c8c0d0}.why li{margin:4px 0}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}.actions button,.actions a{min-height:42px;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;border-radius:6px;padding:0 13px;font-weight:800;font-size:12px;flex:1 1 145px}.wa{background:#d9fdd3;color:#123b24;border:1px solid #70c78a}.wa-icon{width:20px;height:20px;display:inline-grid;place-items:center;flex:0 0 20px}.wa-icon svg{width:20px;height:20px;display:block;fill:currentColor}.ghost{border:1px solid #3a3545;background:#17151d;color:#ddd}.danger{border:1px solid #4d3138;background:#1d1417;color:#e6b6c2}.top3{border-color:#5e4a79;box-shadow:0 0 0 1px rgba(168,139,232,.12) inset}.top3-label{display:inline-flex;align-items:center;gap:6px;margin:0 0 8px;padding:5px 7px;border-radius:5px;background:#211a2b;color:#d9c7ff;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}
.note{margin:13px 0;color:#8f8999;font-size:11px;line-height:1.5}.empty{text-align:center;color:var(--muted);padding:42px 12px;border:1px dashed #302d38;border-radius:8px}
@media(max-width:720px){main{padding-left:12px;padding-right:12px;width:100%}.top{align-items:flex-start}.top h1{font-size:25px}.filters{grid-template-columns:minmax(0,1fr);padding:12px}.filters .city,.filters .primary{grid-column:auto}.filters select,.filters input{font-size:16px}.head{align-items:flex-start}.head>div:first-child{min-width:0}.name{overflow-wrap:anywhere}.score{font-size:19px;flex:0 0 auto}.tools{align-items:stretch;flex-direction:column}.tools button{width:100%}.actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.actions a,.actions button{width:100%;min-width:0;padding:0 9px}.actions .wa{grid-column:1/-1}.card{padding:13px}.badges{gap:5px}.badge{max-width:100%;overflow-wrap:anywhere}}
</style>
</head>
<body>
<main>
  <div class="top"><a class="back" href="admin-mobile.html">← Painel</a><div><h1>Prospecção</h1><p class="sub">Encontre negócios com maior chance de aproveitar atendimento automático.</p></div></div>
  <section class="filters">
    <label>Estado
      <select id="uf"><option value="PR">PR</option><option>SP</option><option>SC</option><option>RS</option><option>MG</option><option>RJ</option><option>ES</option><option>BA</option><option>GO</option><option>DF</option><option>MS</option><option>MT</option><option>PE</option><option>CE</option><option>PA</option><option>AM</option><option>MA</option><option>PB</option><option>RN</option><option>AL</option><option>SE</option><option>PI</option><option>RO</option><option>AC</option><option>AP</option><option>RR</option><option>TO</option></select>
    </label>
    <label class="city">Cidade<input id="cidade" placeholder="Ex.: Londrina" autocomplete="address-level2"></label>
    <label>Categoria
      <select id="categoria">
        <option value="barbearia">Barbearia</option><option value="salao">Salão de beleza</option><option value="tatuagem">Tatuagem</option><option value="restaurante">Restaurante</option><option value="clinica">Clínica</option><option value="oficina">Oficina</option><option value="petshop">Pet shop</option><option value="academia">Academia</option>
      </select>
    </label>
    <button id="buscar" class="primary">Buscar clientes</button>
  </section>
  <div class="tools"><div id="status" class="status">Escolha a cidade e a categoria.</div><button id="verSalvos" class="ghost">Só salvos</button></div>
  <div id="cards" class="cards"></div>
  <p class="note">O ranking é uma estimativa comercial baseada em dados públicos disponíveis. “Automação não identificada” não significa prova de que o negócio não usa atendimento automático.</p>
</main>
<script>
if(!estaAutenticado()) location.replace('login.html');
const $=id=>document.getElementById(id);
const key='saintsai-prospeccao-v1';
let ultimo=[],soSalvos=false;
function estado(){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return {}}}
function salvarEstado(v){localStorage.setItem(key,JSON.stringify(v))}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function render(){
 const st=estado();
 const lista=ultimo.filter(x=>!soSalvos||st[x.id]==='salvo');
 const recomendados=[...ultimo.filter(x=>x.whatsapp),...ultimo.filter(x=>!x.whatsapp)].filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i).slice(0,3);
 const topIds=new Set(recomendados.map(x=>x.id));
 $('cards').innerHTML=lista.length?lista.map(x=>{
   const s=st[x.id]||'';
   const cls=x.score>=84?'high':x.score>=70?'mid':'';
   const top=topIds.has(x.id); return '<article class="card '+(top?'top3':'')+'">'+(top?'<div class="top3-label">★ Top 3 recomendado</div>':'')+'<div class="head"><div><div class="name">'+esc(x.nome)+'</div><div class="badges"><span class="badge '+cls+'">'+esc(x.nivel)+'</span><span class="badge">'+esc(x.categoria)+'</span><span class="badge">'+esc(x.automacao)+'</span></div></div><div class="score">'+x.score+'<small>score</small></div></div>'+
   '<div class="meta">'+(x.endereco?'<div>📍 '+esc(x.endereco)+'</div>':'')+(x.horario?'<div>🕒 '+esc(x.horario)+'</div>':'')+(x.telefone_exibicao?'<div>☎ '+esc(x.telefone_exibicao)+'</div>':'')+(x.site?'<div>🌐 '+esc(x.site)+'</div>':'')+'</div>'+
   '<ul class="why">'+x.motivos.map(m=>'<li>'+esc(m)+'</li>').join('')+'</ul>'+
   '<div class="actions">'+(x.whatsapp?'<a class="wa" target="_blank" rel="noopener" href="'+esc(x.whatsapp)+'" aria-label="Abrir WhatsApp de '+esc(x.nome)+'"><span class="wa-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2a9.7 9.7 0 0 0-8.34 14.65L2.3 21.7l5.17-1.35A9.7 9.7 0 1 0 12 2Zm0 17.63a7.9 7.9 0 0 1-4.03-1.1l-.29-.17-3.07.8.82-2.99-.19-.31A7.92 7.92 0 1 1 12 19.63Zm4.35-5.94c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.92-1.18-.71-.63-1.19-1.42-1.33-1.66-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2 0 1.18.86 2.32.98 2.48.12.16 1.69 2.58 4.1 3.62.57.25 1.02.39 1.37.5.58.18 1.1.16 1.51.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"/></svg></span> Abrir WhatsApp</a>':'<span class="badge">WhatsApp público não encontrado</span>')+
   '<button class="ghost" data-a="salvo" data-id="'+esc(x.id)+'">'+(s==='salvo'?'Salvo ✓':'Salvar')+'</button>'+
   '<button class="ghost" data-a="contatado" data-id="'+esc(x.id)+'">'+(s==='contatado'?'Contatado ✓':'Marcar contatado')+'</button>'+
   '<button class="danger" data-a="descartado" data-id="'+esc(x.id)+'">Descartar</button></div></article>'
 }).join(''):'<div class="empty">'+(soSalvos?'Nenhum lead salvo nesta busca.':'Nenhum estabelecimento encontrado com esses filtros.')+'</div>';
 document.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const st=estado();st[b.dataset.id]=b.dataset.a;salvarEstado(st);render()});
}
async function buscar(){
 const cidade=$('cidade').value.trim(),uf=$('uf').value,categoria=$('categoria').value;
 if(!cidade){$('cidade').focus();return}
 $('buscar').disabled=true;$('buscar').textContent='Buscando…';$('status').textContent='Procurando empresas e calculando prioridade…';$('cards').innerHTML='';
 try{
   const q=new URLSearchParams({uf,cidade,categoria});
   const r=await apiFetch('/admin/prospeccao/buscar?'+q.toString());
   ultimo=(r.leads||[]).filter(x=>estado()[x.id]!=='descartado');
   soSalvos=false;$('verSalvos').textContent='Só salvos';
   const comWhatsapp=ultimo.filter(x=>x.whatsapp).length;
   $('status').textContent=ultimo.length+' oportunidades · '+Math.min(3,ultimo.length)+' recomendadas'+(comWhatsapp?' · '+comWhatsapp+' com contato direto':'')+' · '+(r.categoria||'')+' · '+(r.local||cidade);
   render();
 }catch(e){$('status').textContent=e.message||'Não foi possível buscar empresas.';$('cards').innerHTML='<div class="empty">Falha na busca. Tente novamente.</div>'}
 finally{$('buscar').disabled=false;$('buscar').textContent='Buscar clientes'}
}
$('buscar').onclick=buscar;
$('cidade').addEventListener('keydown',e=>{if(e.key==='Enter')buscar()});
$('verSalvos').onclick=()=>{soSalvos=!soSalvos;$('verSalvos').textContent=soSalvos?'Ver todos':'Só salvos';render()};
</script>
</body></html>`;
write('public/admin-prospeccao.html',page);

for(const p of ['public/admin-mobile.html','public/admin.html']){
  if(!fs.existsSync(p)) continue;
  let h=read(p);
  if(h.includes('admin-prospeccao.html')) continue;
  if(h.includes('</nav>')){
    h=h.replace('</nav>','  <a href="admin-prospeccao.html">🎯 Prospecção</a>\\n</nav>');
  }else if(h.includes('</body>')){
    h=h.replace('</body>','<a href="admin-prospeccao.html" style="position:fixed;right:14px;bottom:14px;z-index:80;padding:12px 14px;border-radius:8px;background:#18131f;color:#d8c7f5;text-decoration:none;border:1px solid #4a3c5c">🎯 Prospecção</a></body>');
  }
  write(p,h);
}

require('node:child_process').execFileSync(process.execPath,['--check','src/services/prospeccao.service.js'],{stdio:'inherit'});
require('node:child_process').execFileSync(process.execPath,['--check','src/controllers/admin.controller.js'],{stdio:'inherit'});
require('node:child_process').execFileSync(process.execPath,['--check','src/routes/admin.routes.js'],{stdio:'inherit'});
console.log('Radar de prospecção SaintsAI instalado.');
