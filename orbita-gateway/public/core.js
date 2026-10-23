(function(root){
'use strict';
function minutes(v){const [h,m]=v.split(':').map(Number);if(!Number.isInteger(h)||!Number.isInteger(m)||h<0||h>23||m<0||m>59)throw Error('Horário inválido.');return h*60+m;}
function validateBooking(bookings,b,hours){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||Number.isNaN(Date.parse(b.date+'T12:00:00Z'))||new Date(b.date+'T12:00:00Z').toISOString().slice(0,10)!==b.date)throw Error('Data inválida.');
 if(!b.client?.trim()||!b.date||!b.professional||!b.service)throw Error('Preencha cliente, data, profissional e serviço.');
 const start=minutes(b.time),end=start+Number(b.duration);
 if(!Number.isFinite(end)||b.duration<=0)throw Error('Duração inválida.');
 const h=hours||{start:'09:00',end:'19:00',lunchStart:'12:00',lunchEnd:'13:00'};
 if(h.days&&!h.days.includes(new Date(b.date+'T12:00:00').getDay()))throw Error('Não há atendimento nesse dia da semana.');
 if(start<minutes(h.start)||end>minutes(h.end))throw Error('Fora do expediente configurado: '+h.start+'–'+h.end+'.');
 if(start<minutes(h.lunchEnd)&&end>minutes(h.lunchStart))throw Error('Intervalo de almoço/pausa: '+h.lunchStart+'–'+h.lunchEnd+'. Escolha outro horário.');
 const conflict=bookings.some(x=>x.date===b.date&&x.professional===b.professional&&x.status!=='Cancelado'&&start<minutes(x.time)+Number(x.duration)&&end>minutes(x.time));
 if(conflict)throw Error('Esse profissional já tem uma reserva nesse intervalo, mesmo por outro número. Escolha outro horário.');
 return true;
}
const api={minutes,validateBooking};root.OrbitaCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
