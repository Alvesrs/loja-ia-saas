'use strict';const {randomInt}=require('node:crypto');const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
function phone(v){let p=String(v||'').replace(/\D/g,'');if(!/^55\d{10,11}$/.test(p))return null;if(p.length===13&&p[4]==='9')p=p.slice(0,4)+p.slice(5);return p;}
const ANGLES=['tempo','agenda','prioridade','pagamento','galeria','fora do horário','organização','autonomia','atendimento presencial','perguntas repetidas','equipe','continuidade','escolha de serviço','fluxo de compra','rotina'];
function opening(lead,index,date=new Date()){
 const name=String(lead.nome||'seu negócio').replace(/[\r\n<>]/g,' ').trim().slice(0,85);
 const templates=[
 `Olá! Sou o Pedro, do SaintsAI. Posso fazer uma pergunta rápida sobre como a ${name} atende pelo WhatsApp?`,
 `Olá! Pedro, do SaintsAI, por aqui. Na ${name}, quem costuma cuidar das mensagens que chegam pelo WhatsApp?`,
 `Olá! Sou o Pedro, do SaintsAI. Trabalho com atendimento pelo WhatsApp. Como vocês organizam os pedidos de horário na ${name}?`,
 `Olá, pessoal da ${name}! Sou o Pedro, do SaintsAI. Posso conversar com quem cuida do atendimento pelo WhatsApp?`,
 `Olá, ${name}! Sou o Pedro, do SaintsAI. Hoje vocês respondem as mensagens do WhatsApp manualmente ou já usam algum sistema?`,
 `Sou o Pedro, do SaintsAI. Uma dúvida sobre a ${name}: o WhatsApp é o principal canal para os clientes entrarem em contato?`,
 `Oi! Sou o Pedro, do SaintsAI. A ${name} centraliza o WhatsApp em uma pessoa ou divide o atendimento com a equipe?`,
 `Olá! Sou o Pedro, do SaintsAI. Posso apresentar uma ideia para organizar o atendimento pelo WhatsApp da ${name}?`,
 `Olá! Sou o Pedro, do SaintsAI. Na ${name}, como vocês confirmam os horários combinados pelo WhatsApp?`,
 `Olá, pessoal da ${name}. Sou o Pedro, do SaintsAI. Quem seria a pessoa certa para conversar sobre o atendimento pelo WhatsApp?`,
 `Oi! Sou o Pedro, do SaintsAI. Vocês preferem tratar assuntos sobre o atendimento da ${name} por este WhatsApp?`,
 `Olá, ${name}! Sou o Pedro, do SaintsAI. Posso entender como funciona o atendimento de vocês pelo WhatsApp antes de apresentar uma proposta?`
 ];return templates[index%templates.length];}
function openingQuality(v){const t=norm(v);return typeof v==='string'&&v.length>=40&&v.length<=320&&(v.match(/\?/g)||[]).length===1&&/saintsai|saints ai/.test(t)&&/pedro/.test(t)&&/whatsapp/.test(t)&&!/(?:perd(?:e|em|er|endo|ido)|maquinas? no cabelo|resolve (?:isso|tudo)|automaticamente|garant|nunca|sempre|noturn|24 horas|aumentar.{0,30}(?:venda|fatur)|instagram|gratis|gratuit|desconto|vi seu|vi o seu)/.test(t);}
function similarity(a,b){const words=v=>new Set(norm(v).split(' ').filter(w=>w.length>3)),x=words(a),y=words(b);return [...x].filter(w=>y.has(w)).length/Math.max(1,new Set([...x,...y]).size);}
function variedOpenings(leads,previous=[],rng=randomInt){const used=new Set(),out=[];for(const lead of leads){let chosen,best=-1;for(let tries=0;tries<60;tries++){const index=rng(12);if(used.has(index))continue;const text=opening(lead,index),max=Math.max(0,...[...previous.slice(-50),...out].map(p=>similarity(text,p))),score=1-max;if(score>best){best=score;chosen={index,text};}if(max<0.37)break;}if(!chosen){const index=[...Array(12).keys()].find(i=>!used.has(i));chosen={index,text:opening(lead,index)};}used.add(chosen.index);out.push(chosen.text);}return out;}
function randomPlace(cities,previous=[],rng=randomInt){const states=[...new Set(cities.map(c=>c[0]))];const recentStates=new Set(previous.slice(0,10).map(t=>t.uf));const available=states.filter(s=>!recentStates.has(s));const uf=(available.length?available:states)[rng((available.length?available:states).length)];const seen=new Set(previous.map(t=>t.uf+'|'+t.cidade));let candidates=cities.filter(c=>c[0]===uf&&!seen.has(c[0]+'|'+c[1]));if(!candidates.length)candidates=cities.filter(c=>c[0]===uf);const city=candidates[rng(candidates.length)];return{uf:city[0],cidade:city[1]};}
function rank(leads,seen,own){const unique=new Map();for(const l of leads||[]){const p=phone(l.telefone);if(!p||p===phone(own)||seen.has(p)||!l.whatsapp||!l.nome||!l.fonte&&!l.origem)continue;if(!unique.has(p))unique.set(p,{...l,canonical_phone:p});}return [...unique.values()].sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0)||a.nome.localeCompare(b.nome,'pt-BR'));}
function category(v){const t=norm(v);if(/salao|manicure|beleza/.test(t))return 'salao';if(/roupa|vestuario/.test(t))return 'roupas';if(/odont|dentist/.test(t))return 'odontologia';if(/clinica|estetica/.test(t))return 'clinica';if(/tatu/.test(t))return 'tatuagem';if(/oficina|mecan/.test(t))return 'oficina';if(/padaria/.test(t))return 'padaria';if(/restaurante/.test(t))return 'restaurante';return 'barbearia';}
module.exports={norm,phone,opening,rank,category,variedOpenings,randomPlace,similarity,ANGLES};

module.exports.openingQuality=openingQuality;
