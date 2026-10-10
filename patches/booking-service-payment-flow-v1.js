const fs=require('node:fs');
fs.copyFileSync('patches/assets/owner-booking-demo.service.js','src/services/ownerBookingDemo.service.js');
fs.copyFileSync('patches/assets/acoesWhatsapp.service.js','src/services/acoesWhatsapp.service.js');
let p='src/services/agendaWhatsapp.service.js',s=fs.readFileSync(p,'utf8');
const start=s.indexOf('  if(!ativo){\n    try{\n      const linkPublico=');const end=s.indexOf('  if(!ativo)estado={ativo:true};',start);
if(start<0||end<0)throw Error('Service-first entry anchor missing');s=s.slice(0,start)+s.slice(end);
s=s.replace("if(dataValida(x.data))estado.data=x.data;", "if(dataValida(x.data))estado.data=x.data;else if(servico&&!estado.data)estado.data=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());");
s=s.replace("estado.pagamento_metodo='pix_online';estado.aguardando_pagamento_metodo=false;", "estado.pagamento_metodo='pix_online';estado.aguardando_pagamento_metodo=false;estado.aguardando_confirmacao=true;estado.pagamento_escolhido_agora=true;");
s=s.replace("estado.pagamento_metodo='presencial';estado.aguardando_pagamento_metodo=false;", "estado.pagamento_metodo='presencial';estado.aguardando_pagamento_metodo=false;estado.aguardando_confirmacao=true;estado.pagamento_escolhido_agora=true;");
s=s.replace('if(estado.aguardando_confirmacao&&SIM.test(normalizar(texto)))','if(estado.aguardando_confirmacao&&(SIM.test(normalizar(texto))||estado.pagamento_escolhido_agora))');
fs.writeFileSync(p,s);
p='src/services/profissionais.service.js';s=fs.readFileSync(p,'utf8');
const anchor='  const legacy=pros.length===0;';let offset=0;
for(const missing of ['[]','null']){const idx=s.indexOf(anchor,offset);if(idx<0)throw Error('Professional fallback anchor missing');const guard="  if(!pros.length){const existing=await supabase.from('saintsai_profissionais').select('id').eq('loja_id',lojaId).limit(1);if(existing.error)throw existing.error;if(existing.data?.length)return "+missing+";}\n";s=s.slice(0,idx)+guard+s.slice(idx);offset=idx+guard.length+anchor.length;}
fs.writeFileSync(p,s);
p='src/services/iaPrompt.service.js';s=fs.readFileSync(p,'utf8').replace('const SYSTEM_PROMPT_ATENDENTE = `','const SYSTEM_PROMPT_ATENDENTE = `\nSó cite profissionais presentes nos dados cadastrados desta empresa. Sem profissionais cadastrados, conduza pelo serviço e pela agenda do estabelecimento sem inventar nomes ou pedir escolha de profissional.');fs.writeFileSync(p,s);
console.log('Serviço primeiro; pagamento após horário; profissionais somente quando cadastrados.');
