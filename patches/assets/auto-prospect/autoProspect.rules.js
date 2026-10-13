'use strict';const {randomInt}=require('node:crypto');const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
function phone(v){let p=String(v||'').replace(/\D/g,'');if(!/^55\d{10,11}$/.test(p))return null;if(p.length===13&&p[4]==='9')p=p.slice(0,4)+p.slice(5);return p;}
const ANGLES=['tempo','agenda','prioridade','pagamento','galeria','fora do horário','organização','autonomia','atendimento presencial','perguntas repetidas','equipe','continuidade','escolha de serviço','fluxo de compra','rotina'];
function opening(lead,index,date=new Date()){
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(date)),greeting=hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';
 const name=String(lead.nome||'seu negócio').replace(/[\r\n<>]/g,' ').trim().slice(0,85),category=norm(lead.categoria),service=/roupa|loja|produto/.test(category)?'modelos e preços':'horários e serviços';
 const templates=[
 `${greeting}! Quem cuida do WhatsApp da ${name} nos momentos mais movimentados?`,
 `Olá, ${name}! Trabalho com atendimento pelo WhatsApp. Posso explicar uma forma de organizar as solicitações sem interromper o atendimento presencial?`,
 `Uma dúvida rápida para a ${name}: pedidos de ${service} chegam pelo WhatsApp ou vocês preferem outro canal?`,
 `${greeting}, equipe da ${name}. Vocês já usam alguma solução para responder dúvidas recorrentes no WhatsApp?`,
 `Olá! Na ${name}, quem chama no WhatsApp depois do expediente recebe alguma orientação ou precisa esperar vocês voltarem?`,
 `${name}, tudo bem? Qual parte do atendimento pelo WhatsApp costuma tomar mais tempo no dia a dia?`,
 `Sou do SaintsAI. Ajudamos a organizar conversas, agendamentos e cobranças no WhatsApp. Isso teria alguma utilidade na rotina da ${name}?`,
 `${greeting}! O WhatsApp da ${name} fica com uma pessoa só ou a equipe divide as respostas?`,
 `Queria entender uma coisa sobre a ${name}: o cliente consegue escolher ${service} pelo WhatsApp sem precisar de várias trocas de mensagem?`,
 `Olá, ${name}. Quando o atendimento presencial exige atenção, vocês deixam as mensagens do WhatsApp para mais tarde?`,
 `${name}, posso fazer uma pergunta? Vocês confirmam agendamentos pelo WhatsApp manualmente ou já têm essa parte organizada?`,
 `${greeting}! Vocês recebem pelo WhatsApp muitas perguntas que já responderam antes na ${name}?`,
 `Olá! Como a ${name} mostra referências ou produtos para quem está escolhendo pelo WhatsApp?`,
 `Estou conversando com negócios sobre atendimento no WhatsApp. Na ${name}, responder mensagens compete com alguma outra tarefa?`,
 `${name}, tudo bem? Se alguém começa a conversar pelo WhatsApp e fica de decidir depois, vocês conseguem acompanhar esse atendimento?`,
 `Uma pergunta para a ${name}: vocês costumam receber dúvidas sobre ${service} em horários em que ninguém consegue responder o WhatsApp?`,
 `${greeting}! Quando há mais de uma conversa no WhatsApp da ${name}, como vocês definem quem será atendido primeiro?`,
 `Olá, equipe da ${name}. Posso apresentar uma alternativa para o WhatsApp continuar atendendo enquanto vocês trabalham?`,
 `Como funciona a confirmação de pagamento com os clientes da ${name}? Essa troca de informações também acontece no WhatsApp?`,
 `${name}, quais informações vocês precisam repetir no WhatsApp antes de concluir um agendamento ou pedido?`,
 `Olá! O cliente da ${name} já consegue encontrar as informações de que precisa na primeira conversa pelo WhatsApp?`,
 `${greeting}. Faz sentido para a ${name} reduzir o tempo dedicado às perguntas de rotina no WhatsApp?`,
 `${name}, vocês preferem conversar individualmente no WhatsApp ou usam um catálogo para facilitar a escolha do cliente?`,
 `Tenho uma pergunta para a ${name}: o WhatsApp é usado mais para tirar dúvidas ou para concluir pedidos e agendamentos?`,
 `Olá, ${name}! Se a pessoa responsável pelo WhatsApp estiver ocupada, outra pessoa assume ou o atendimento aguarda?`,
 `${greeting}! Como a ${name} registra o que ficou combinado com cada cliente pelo WhatsApp?`,
 `${name}, gostaria de entender se a organização dos atendimentos pelo WhatsApp é uma prioridade para vocês neste momento.`,
 `Oi, equipe da ${name}. Vocês recebem fotos e referências dos clientes pelo WhatsApp para ajudar na escolha?`,
 `Trabalho com o SaintsAI, um atendimento virtual para WhatsApp. Posso contar como ele se encaixaria na rotina da ${name}?`,
 `${greeting}, ${name}! Qual seria mais útil hoje: responder dúvidas, organizar a agenda ou acompanhar pedidos no WhatsApp?`
 ];return templates[((index%templates.length)+templates.length)%templates.length];
}
function similarity(a,b){const words=v=>new Set(norm(v).split(' ').filter(w=>w.length>3)),x=words(a),y=words(b);return [...x].filter(w=>y.has(w)).length/Math.max(1,new Set([...x,...y]).size);}
function variedOpenings(leads,previous=[],rng=randomInt){const used=new Set(),out=[];for(const lead of leads){let chosen,best=-1;for(let tries=0;tries<60;tries++){const index=rng(30);if(used.has(index))continue;const text=opening(lead,index),max=Math.max(0,...[...previous.slice(-50),...out].map(p=>similarity(text,p))),score=1-max;if(score>best){best=score;chosen={index,text};}if(max<0.37)break;}if(!chosen){const index=[...Array(30).keys()].find(i=>!used.has(i));chosen={index,text:opening(lead,index)};}used.add(chosen.index);out.push(chosen.text);}return out;}
function randomPlace(cities,previous=[],rng=randomInt){const states=[...new Set(cities.map(c=>c[0]))];const recentStates=new Set(previous.slice(0,10).map(t=>t.uf));const available=states.filter(s=>!recentStates.has(s));const uf=(available.length?available:states)[rng((available.length?available:states).length)];const seen=new Set(previous.map(t=>t.uf+'|'+t.cidade));let candidates=cities.filter(c=>c[0]===uf&&!seen.has(c[0]+'|'+c[1]));if(!candidates.length)candidates=cities.filter(c=>c[0]===uf);const city=candidates[rng(candidates.length)];return{uf:city[0],cidade:city[1]};}
function rank(leads,seen,own){const unique=new Map();for(const l of leads||[]){const p=phone(l.telefone);if(!p||p===phone(own)||seen.has(p)||!l.whatsapp||!l.nome||!l.fonte&&!l.origem)continue;if(!unique.has(p))unique.set(p,{...l,canonical_phone:p});}return [...unique.values()].sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0)||a.nome.localeCompare(b.nome,'pt-BR'));}
function category(v){const t=norm(v);if(/salao|manicure|beleza/.test(t))return 'salao';if(/roupa|vestuario/.test(t))return 'roupas';if(/odont|dentist/.test(t))return 'odontologia';if(/clinica|estetica/.test(t))return 'clinica';if(/tatu/.test(t))return 'tatuagem';if(/oficina|mecan/.test(t))return 'oficina';if(/padaria/.test(t))return 'padaria';if(/restaurante/.test(t))return 'restaurante';return 'barbearia';}
module.exports={norm,phone,opening,rank,category,variedOpenings,randomPlace,similarity,ANGLES};
