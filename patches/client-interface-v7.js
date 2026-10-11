// One client shell and fresh, coalesced reads. Runs after every legacy generation patch.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assets=path.join(__dirname,'assets/client-v7');
for(const file of ['client-runtime-v7.js','client-shell-v7.js'])fs.copyFileSync(path.join(assets,file),'public/js/'+file);
const replace=(file,from,to)=>{let text=fs.readFileSync(file,'utf8');if(!text.includes(from))throw Error('Client v7 anchor missing: '+file+' '+from.slice(0,70));fs.writeFileSync(file,text.replace(from,to));};
// Company metadata belongs to the authenticated account; financial data is never cached here.
fs.writeFileSync('public/js/loja.js',`const LOJA_CACHE_KEY='lojaia_loja_atual',LOJA_ID_KEY='lojaia_loja_atual_id',LOJA_USER_KEY='saintsai_loja_cache_user';
const lojaFlights=new Map();const lojaUser=()=>String(typeof obterUsuario==='function'?obterUsuario()?.id||'anonymous':'anonymous');
async function listarMinhasLojas(){const lojas=await apiFetch('/lojas');return Array.isArray(lojas)?lojas:[];}
function salvarLojaAtual(loja){if(!loja?.id)return;sessionStorage.setItem(LOJA_CACHE_KEY,JSON.stringify(loja));sessionStorage.setItem(LOJA_USER_KEY,lojaUser());localStorage.setItem(LOJA_ID_KEY,loja.id);}
function limparLojaAtual(){sessionStorage.removeItem(LOJA_CACHE_KEY);sessionStorage.removeItem(LOJA_USER_KEY);localStorage.removeItem(LOJA_ID_KEY);}
async function obterLojaAtual({forcarRecarregar=false}={}){const identity=lojaUser();if(!forcarRecarregar&&sessionStorage.getItem(LOJA_USER_KEY)===identity){try{const cached=JSON.parse(sessionStorage.getItem(LOJA_CACHE_KEY)||'null');if(cached?.id)return cached;}catch(_){sessionStorage.removeItem(LOJA_CACHE_KEY);}}
if(lojaFlights.has(identity))return lojaFlights.get(identity);const work=(async()=>{const lojas=await listarMinhasLojas();if(lojaUser()!==identity)return null;if(!lojas.length){limparLojaAtual();return null;}const preferred=localStorage.getItem(LOJA_ID_KEY),loja=lojas.find(x=>x.id===preferred)||lojas[0];salvarLojaAtual(loja);return loja;})();lojaFlights.set(identity,work);try{return await work;}finally{if(lojaFlights.get(identity)===work)lojaFlights.delete(identity);}}
async function selecionarLoja(lojaId){const identity=lojaUser(),lojas=await listarMinhasLojas();if(lojaUser()!==identity)throw Error('O acesso mudou. Abra a empresa novamente.');const loja=lojas.find(x=>x.id===lojaId);if(!loja)throw Error('Loja não encontrada.');salvarLojaAtual(loja);return loja;}
`);
const dashboard='public/js/cliente-dashboard-v2.js';
replace(dashboard,",['box','Entregas','cliente-entregas.html']",'');
replace(dashboard,'carregarHomeNegocio=function(){if(!loja||financePending)return financePending;','carregarHomeNegocio=function({hubAtual=null}={}){if(!loja)return null;if(financePending)return hubAtual?financePending.then(()=>carregarHomeNegocio({hubAtual})):financePending;');
replace(dashboard,"apiFetch('/lojas/'+loja.id+'/cliente-hub').catch(()=>null)","(hubAtual?Promise.resolve(hubAtual):apiFetch('/lojas/'+loja.id+'/cliente-hub')).catch(()=>null)");
let d=fs.readFileSync(dashboard,'utf8');const brandStart=d.indexOf('function renderBrand('),brandEnd=d.indexOf('\nfunction renderToday()',brandStart);if(brandStart<0||brandEnd<0)throw Error('Client brand anchor missing');
d=d.slice(0,brandStart)+`function renderBrand(brand){const name=brand.nome||loja?.nome||'Sua empresa';set('loja-nome',name);profileButton.setAttribute('aria-label','Abrir perfil de '+name);const letter=document.createElement('span');letter.className='sa-company-logo sa-company-letter';letter.textContent=name.trim().slice(0,1).toUpperCase();profileButton.replaceChildren(letter);if(brand.imagem_url){const img=document.createElement('img');img.src=brand.imagem_url;img.alt='';img.className='sa-company-logo';img.onerror=()=>profileButton.replaceChildren(letter);profileButton.replaceChildren(img);}}`+d.slice(brandEnd);fs.writeFileSync(dashboard,d);
for(const id of ['sa-records','sa-today-list'])replace(dashboard,'id="'+id+'" aria-live="polite"','id="'+id+'" class="v7-pending" aria-live="polite"');
replace(dashboard,`<small id="'+id+'">Verificando`,`<small class="v7-pending" id="'+id+'">Verificando`);
const central='public/cliente-central.html';
replace(central,'<div id="setup-zone" class="setup-wrap">','<div id="setup-zone" class="setup-wrap" hidden>');
replace(central,"dados=await apiFetch('/lojas/'+loja.id+'/cliente-hub');","const hubTask=apiFetch('/lojas/'+loja.id+'/cliente-hub');const homeTask=carregarHomeNegocio({hubAtual:hubTask});dados=await hubTask;");
replace(central,'carregarOnboarding();carregarHomeNegocio();renderAgendaConfig();','carregarOnboarding();if(!homeTask)carregarHomeNegocio({hubAtual:dados});renderAgendaConfig();');
replace(central,'\ncarregar();','\ndocument.addEventListener("DOMContentLoaded",()=>carregar(),{once:true});');
// Remove the two later DOM remakes and combine the shared blocking styles into one cached asset.
const shared=new Set(['styles.css','cliente-interface-v2.css','saintsai-polish-v4.css','cliente-rework.css','saintsai-remake.css']);
const obsolete=new Set(['cliente-remaster-v5.css','saintsai-neon-v6.css']);let pages=0;
for(const name of fs.readdirSync('public').filter(n=>/^cliente-.*\.html$/.test(n)&&!/(login|primeiro-acesso|acesso|copiloto|midias)/.test(n))){const file='public/'+name;let html=fs.readFileSync(file,'utf8');const styles=[];html=html.replace(/<link\b[^>]*>/gi,tag=>{const href=tag.match(/\bhref=["']([^"']+)["']/i)?.[1],css=href?.split('?')[0].replace(/^css\//,'');if(!href||!tag.includes('stylesheet'))return tag;if(obsolete.has(css))return '';if(shared.has(css)){styles.push(css);return '';}return tag;});
const body=styles.map(n=>'/* '+n+' */\n'+fs.readFileSync('public/css/'+n,'utf8')).join('\n')+'\n'+fs.readFileSync(path.join(assets,'client-shell-v7.css'),'utf8');const digest=crypto.createHash('sha256').update(body).digest('hex').slice(0,12),bundle='client-v7-'+digest+'.css';fs.writeFileSync('public/css/'+bundle,body);
html=html.replace(/<script\b[^>]*src=["']js\/(?:cliente-remaster-v5|saintsai-neon-v6|cliente-rework)\.js[^"']*["'][^>]*>\s*<\/script>/gi,'');
html=html.replace('<div class="empty">Carregando agenda…</div>','<div class="empty v7-pending">Carregando agenda…</div>');
html=html.replace('</head>','<script>document.documentElement.classList.add("sa-client-v7");</script><link rel="stylesheet" href="css/'+bundle+'"></head>');
html=html.replace(/(<script\b[^>]*src=["']js\/api\.js[^"']*["'][^>]*>\s*<\/script>)/i,'$1<script src="js/client-runtime-v7.js?v=2026.10.11.23"></script>');
html=html.replace('</body>','<script src="js/client-shell-v7.js?v=2026.10.11.23"></script></body>');fs.writeFileSync(file,html);pages++;}
console.log('[client.v7] '+pages+' pages: one shell, combined CSS, fresh coalesced reads');
const release=JSON.parse(fs.readFileSync('public/cliente-versao.json','utf8'));
fs.writeFileSync('public/cliente-versao.json',JSON.stringify({...release,versao:'2026.10.11.23',publicado_em:'2026-10-11',novidades:['Nova interface do Cliente e cabeçalho da empresa','Menu único com Agenda, Galeria e Agente IA','Menos consultas repetidas e carregamentos sem piscar','Novo agendamento abre o formulário diretamente']},null,2)+'\n');
require('node:child_process').execFileSync(process.execPath,['--test','tests/client-interface-v7.test.cjs'],{stdio:'inherit'});
