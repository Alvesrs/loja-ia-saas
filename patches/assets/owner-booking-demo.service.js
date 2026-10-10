const db=require('../config/supabase');const {escolhas}=require('./acoesWhatsapp.service');
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const services=[{id:'demo:corte',nome:'Corte social',valor:30},{id:'demo:degrade',nome:'Degradê',valor:35},{id:'demo:barba',nome:'Corte e barba',valor:50}];
const slots=['09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00'];
async function save(c,b){const {error}=await db.from('saintsai_sales_conversations').update({briefing:b,atualizado_em:new Date().toISOString()}).eq('id',c.id);if(error)throw error;}
const reply=(response,options)=>({handled:true,response,...(options?{interativo:escolhas(options)}:{})});
const cuts=()=>reply('🧪 Escolha o corte. Demonstração com dados fictícios; nenhuma reserva real.',services.map(s=>({value:s.id,title:s.nome+' R$'+s.valor})));
function times(b){return reply('🧪 Escolha o horário fictício para '+b.__demo_service.nome+' em '+b.__demo_day+'. Nenhuma agenda real foi consultada.',slots.map(t=>({value:'demo:hora:'+t,title:t})));}
async function tentar(args,c){const input=norm(args.pergunta),b=c.briefing||{};
 if(/simul|testar|teste|demonstr|fictici/.test(input)&&/agend|barbearia|horario/.test(input)){
  const day=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short'}).format(new Date(Date.now()+86400000));
  await save(c,{...b,__lab_booking_phase:'service',__demo_service:null,__demo_slot:null,__demo_day:day});return cuts();
 }
 if(!b.__lab_booking_phase)return null;
 if(b.__lab_booking_phase==='service'){const s=services.find(s=>input===s.id||input===norm(s.nome));if(!s)return /demo:|corte|degrade/.test(input)?cuts():null;const next={...b,__demo_service:s,__lab_booking_phase:'slot'};await save(c,next);return times(next);}
 if(b.__lab_booking_phase==='slot'){const t=input.replace(/^demo:hora:/,'');if(!slots.includes(t))return /demo:|horario|^\d\d:\d\d$/.test(input)?times(b):null;
  await save(c,{...b,__demo_slot:t,__lab_booking_phase:'confirm'});return reply('🧪 '+b.__demo_service.nome+' · R$'+b.__demo_service.valor+' · '+b.__demo_day+' às '+t+'. Confirmar o agendamento fictício?',[{value:'demo:confirmar',title:'Confirmar'},{value:'demo:outro',title:'Outro horário'}]);}
 if(input==='demo:outro'){const next={...b,__lab_booking_phase:'slot'};await save(c,next);return times(next);}
 if(b.__lab_booking_phase==='confirm'&&input==='demo:confirmar'){await save(c,{...b,__lab_booking_phase:'payment'});return reply('🧪 Agendamento fictício selecionado. Escolha a forma de pagamento da simulação.',[{value:'demo:pix',title:'Pix (simulação)'},{value:'demo:local',title:'Pagar no local'}]);}
 if(b.__lab_booking_phase==='payment'&&['demo:pix','demo:local'].includes(input)){await save(c,{...b,__lab_booking_phase:null});return reply('🧪 Demonstração concluída: '+b.__demo_service.nome+' em '+b.__demo_day+' às '+b.__demo_slot+', R$'+b.__demo_service.valor+'. '+(input==='demo:pix'?'Pix apenas simulado.':'Pagamento no local simulado.')+' Nenhuma reserva ou cobrança real foi criada.');}
 return null;
}
module.exports={tentar,services,slots};
