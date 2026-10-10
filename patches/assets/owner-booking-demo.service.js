const db=require('../config/supabase');const {escolhas}=require('./acoesWhatsapp.service');
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const services=[{id:'demo:corte',nome:'Corte social',valor:30,duracao:30,descanso:10},{id:'demo:degrade',nome:'Degradê',valor:35,duracao:40,descanso:10},{id:'demo:barba',nome:'Corte e barba',valor:50,duracao:60,descanso:10}];
function today(now=Date.now()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));}
function addDay(day,n=1){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function label(day){return day.split('-').reverse().join('/');}
function slots(day,service,now=Date.now()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<today(now)||new Date(day+'T12:00:00Z').getUTCDay()===0)return[];
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(now)).split(':').map(Number),minute=parts[0]*60+parts[1];
 const length=service.duracao+service.descanso,out=[];
 for(let t=540;t+length<=1080;){if(t<780&&t+length>720){t=780;continue;}if(day!==today(now)||t>minute)out.push(String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0'));t+=length;}
 return out;
}
function nextAvailable(day,s){for(let n=1;n<=30;n++){const d=addDay(day,n);if(slots(d,s).length)return d;}return null;}
async function save(c,b){const {error}=await db.from('saintsai_sales_conversations').update({briefing:b,atualizado_em:new Date().toISOString()}).eq('id',c.id);if(error)throw error;}
const reply=(response,options)=>({handled:true,response,...(options?{interativo:escolhas(options)}:{})});
const cuts=()=>reply('🧪 Escolha o corte. Demonstração com dados fictícios; nenhuma reserva real.',services.map(s=>({value:s.id,title:s.nome+' R$'+s.valor})));
function times(b){const day=b.__demo_date||today(),all=slots(day,b.__demo_service),page=b.__demo_page||0,options=all.slice(page*8,page*8+8).map(t=>({value:'demo:hora:'+day+':'+t,title:t}));
 if(page>0)options.push({value:'demo:pagina:'+day+':0',title:'Primeiros horários'});
 if(all.length>(page+1)*8)options.push({value:'demo:pagina:'+day+':'+(page+1),title:'Mais horários'});
 const tomorrow=addDay(today());if(day===today())options.push({value:'demo:dia:'+tomorrow,title:'Escolher amanhã'});else{const next=nextAvailable(day,b.__demo_service);if(next)options.push({value:'demo:dia:'+next,title:'Próximo dia disponível'});options.push({value:'demo:dia:'+today(),title:'Ver hoje'});}
 // Ten rows is the WhatsApp list limit; paged slots keep every available time reachable.
 return reply(all.length?'🧪 '+b.__demo_service.nome+' · '+label(day)+'. Escolha um horário fictício.':'🧪 Não há horário disponível em '+label(day)+'. Você pode escolher outro dia e deixar o atendimento fictício agendado.',options.slice(0,10));}
async function tentar(args,c){const input=norm(args.pergunta);let b=c.briefing||{};if(b.__demo_service){const known=services.find(s=>s.id===b.__demo_service.id);if(known)b={...b,__demo_service:known};}if(!b.__demo_date)b={...b,__demo_date:today(),__demo_day:label(today()),__demo_page:0};
 if(/simul|testar|teste|demonstr|fictici/.test(input)&&/agend|barbearia|horario/.test(input)){
  const day=today();
  await save(c,{...b,__lab_booking_phase:'service',__demo_service:null,__demo_slot:null,__demo_day:label(day),__demo_date:day,__demo_page:0});return cuts();
 }
 if(!b.__lab_booking_phase)return null;
 if(b.__lab_booking_phase==='service'){const s=services.find(s=>input===s.id||input===norm(s.nome));if(!s)return /demo:|corte|degrade/.test(input)?cuts():null;const next={...b,__demo_service:s,__demo_date:today(),__demo_day:label(today()),__demo_page:0,__lab_booking_phase:'slot'};await save(c,next);return times(next);}
 if(b.__lab_booking_phase==='slot'){
  const dayChoice=input.match(/^demo:dia:(\d{4}-\d{2}-\d{2})$/),paging=input.match(/^demo:pagina:(\d{4}-\d{2}-\d{2}):(\d+)$/);
  if(dayChoice||paging){const day=(dayChoice||paging)[1];if(day<today()||day>addDay(today(),30))return times(b);const next={...b,__demo_date:day,__demo_day:label(day),__demo_page:paging?Number(paging[2]):0};await save(c,next);return times(next);}
  const selection=input.match(/^demo:hora:(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2})$/),day=selection?.[1]||b.__demo_date||today(),t=selection?.[2]||input.replace(/^demo:hora:/,'');
  if(day!==b.__demo_date||!slots(day,b.__demo_service).includes(t))return /demo:|horario|^\d\d:\d\d$/.test(input)?times(b):null;
  await save(c,{...b,__demo_slot:t,__lab_booking_phase:'payment'});return reply('🧪 '+b.__demo_service.nome+' · R$'+b.__demo_service.valor+' · '+b.__demo_day+' às '+t+'. Como prefere pagar?',[{value:'demo:pix',title:'Pagar agora'},{value:'demo:local',title:'Pagar no local'},{value:'demo:outro',title:'Outro horário'}]);}
 if(input==='demo:outro'){const next={...b,__lab_booking_phase:'slot'};await save(c,next);return times(next);}
 if(b.__lab_booking_phase==='confirm'&&input==='demo:confirmar'){if(!slots(b.__demo_date,b.__demo_service).includes(b.__demo_slot)){const next={...b,__lab_booking_phase:'slot',__demo_slot:null,__demo_date:today(),__demo_day:label(today()),__demo_page:0};await save(c,next);return times(next);}await save(c,{...b,__lab_booking_phase:'payment'});return reply('🧪 Agendamento fictício selecionado. Escolha a forma de pagamento da simulação.',[{value:'demo:pix',title:'Pagar agora'},{value:'demo:local',title:'Pagar no local'}]);}
 if(b.__lab_booking_phase==='payment'&&['demo:pix','demo:local'].includes(input)){await save(c,{...b,__lab_booking_phase:null});return reply('🧪 Demonstração concluída: '+b.__demo_service.nome+' em '+b.__demo_day+' às '+b.__demo_slot+', R$'+b.__demo_service.valor+'. '+(input==='demo:pix'?'Pix apenas simulado.':'Pagamento no local simulado.')+' Nenhuma reserva ou cobrança real foi criada.');}
 return null;
}
module.exports={tentar,services,slots,today,addDay,nextAvailable};
