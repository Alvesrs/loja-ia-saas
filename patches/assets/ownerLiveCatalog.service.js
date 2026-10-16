'use strict';
const db=require('../config/supabase'),{escolhas,lerId}=require('./acoesWhatsapp.service');
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const safe=v=>String(v||'').replace(/[\x00-\x1f]/g,' ').slice(0,500);
const money=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PREFIX='saintsai:demo:';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function dayPlus(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function topic(value){const t=norm(value);if(t.startsWith(PREFIX))return t;
 if(/^(?:saintsai:ver:servicos|escolher servico|ver servicos|servicos|quais (?:os )?servicos(?: disponiveis)?\??|quais servicos (?:tem|voces tem)\??)$/.test(t))return PREFIX+'services:1';
 if(/^(?:saintsai:ver:pagamento|saintsai:ver:pix|saintsai:ver:local|formas de pagamento|quais (?:as )?formas de pagamento\??)$/.test(t))return PREFIX+'payments';
 if(t==='saintsai:ver:horarios')return PREFIX+'services:1';return null;}
const action=(value,title,description)=>({value,title,description,forceList:true});
const paymentsButton=()=>action(PREFIX+'payments','Formas de pagamento');
const servicesButton=()=>action(PREFIX+'services:1','Ver serviços');
const reply=(resposta,options)=>({resposta,...(options?.length?{interativo:escolhas(options)}:{})});
async function query(q){const r=await q;if(r.error)throw r.error;return r.data;}
async function service(lojaId,id){return query(db.from('saintsai_servicos').select('id,nome,descricao,preco,duracao_min,intervalo_pos_min').eq('loja_id',lojaId).eq('id',id).eq('ativo',true).maybeSingle());}
async function paymentOptions(lojaId){const cfg=await query(db.from('saintsai_pagamento_config').select('provedor,conectado,aceita_pix_online,aceita_pix_presencial,aceita_dinheiro,aceita_cartao_presencial,exige_pagamento_antecipado').eq('loja_id',lojaId).maybeSingle());const options=[];
 if(cfg?.aceita_pix_online&&cfg.conectado&&['asaas','pagbank','mercadopago'].includes(cfg.provedor))options.push({id:'pix_online',nome:'Pix online'});
 if(cfg?.aceita_pix_presencial)options.push({id:'pix_presencial',nome:'Pix no atendimento'});
 if(cfg?.aceita_dinheiro)options.push({id:'dinheiro',nome:'Dinheiro no atendimento'});
 if(cfg?.aceita_cartao_presencial)options.push({id:'cartao_presencial',nome:'Cartão no atendimento'});
 return{cfg,options};}
async function payments(lojaId,prefix=''){const {cfg,options}=await paymentOptions(lojaId);if(!options.length)return reply(prefix+'As formas de pagamento ainda não estão configuradas nesta loja.',[servicesButton()]);
 return reply(prefix+'Formas de pagamento cadastradas:\n'+options.map(x=>x.nome).join('\n')+'\nVocê pode conhecer as opções sem pagar. Nenhuma cobrança foi criada.'+(cfg.exige_pagamento_antecipado?' No atendimento real, esta loja exige pagamento antecipado.':' No atendimento real, esta loja permite pagar no atendimento.'),[...options.map(x=>action(PREFIX+'payment:'+x.id,x.nome)),servicesButton()]);}
async function answer(lojaId,command){const t=topic(command);if(!t)return null;
 const page=t.match(/^saintsai:demo:services:([1-9]\d{0,3})$/);if(page){const p=Number(page[1]),size=8,rows=await query(db.from('saintsai_servicos').select('id,nome,descricao,preco,duracao_min').eq('loja_id',lojaId).eq('ativo',true).order('nome').range((p-1)*size,p*size));
  if(!rows?.length)return reply(p===1?'Não há serviços ativos cadastrados nesta loja.':'Não há mais serviços nesta página.',[paymentsButton(),...(p>1?[servicesButton()]:[])]);
  const shown=rows.slice(0,size),options=shown.map(s=>action(PREFIX+'service:'+s.id,safe(s.nome),money(s.preco)+' · '+Number(s.duracao_min||0)+' min'));
  if(rows.length>size)options.push(action(PREFIX+'services:'+(p+1),'Mais serviços'));options.push(paymentsButton());
  return reply('Serviços cadastrados nesta loja:\n'+shown.map(s=>safe(s.nome)+' · '+money(s.preco)+' · '+Number(s.duracao_min||0)+' min').join('\n')+'\nEscolha um serviço para ver as próximas opções. Esta consulta não cria reserva nem cobrança.',options);}
 if(t===PREFIX+'payments')return payments(lojaId);
 const chosen=t.match(new RegExp('^saintsai:demo:service:('+uuid+')$'));if(chosen){const s=await service(lojaId,chosen[1]);if(!s)return reply('Esse serviço não está mais disponível nesta loja.',[servicesButton()]);return reply(safe(s.nome)+' · '+money(s.preco)+' · '+Number(s.duracao_min||0)+' min'+(s.descricao?'\n'+safe(s.descricao):'')+'\nO que você quer ver? Nenhuma reserva ou cobrança foi criada.',[action(PREFIX+'hours:'+s.id+':'+today()+':1','Ver horários'),paymentsButton(),servicesButton()]);}
 const hours=t.match(new RegExp('^saintsai:demo:hours:('+uuid+'):(\\d{4}-\\d{2}-\\d{2}):([1-9]\\d{0,2})$'));
 const slot=t.match(new RegExp('^saintsai:demo:slot:('+uuid+'):(\\d{4}-\\d{2}-\\d{2}):(\\d{2}:\\d{2})$'));
 if(hours||slot){const m=hours||slot,s=await service(lojaId,m[1]),day=m[2];if(!s)return reply('Esse serviço não está mais disponível.',[servicesButton()]);if(day<today()||day>dayPlus(today(),31)||Number.isNaN(Date.parse(day+'T12:00:00Z')))return reply('Escolha uma data disponível a partir de hoje.',[action(PREFIX+'hours:'+s.id+':'+today()+':1','Ver hoje')]);
  const cfg=await query(db.from('saintsai_agenda_config').select('*').eq('loja_id',lojaId).maybeSingle());if(!cfg?.horarios)return reply('A agenda ainda não está configurada nesta loja.',[paymentsButton(),servicesButton()]);
  const rows=await require('./profissionais.service').slotsDia(lojaId,s,day,cfg);const times=[...new Set(rows.map(x=>x.hora))].filter(h=>/^([01]\d|2[0-3]):[0-5]\d$/.test(h)&&Date.parse(day+'T'+h+':00-03:00')>Date.now()).sort();
  if(slot){if(!times.includes(slot[3]))return reply('Esse horário já não está disponível. Escolha outro.',[action(PREFIX+'hours:'+s.id+':'+day+':1','Atualizar horários')]);return payments(lojaId,safe(s.nome)+' · '+day.split('-').reverse().join('/')+' às '+slot[3]+' · '+money(s.preco)+'\nPrévia do fluxo, sem agendamento criado.\n');}
  const p=Number(hours[3]),shown=times.slice((p-1)*7,p*7),options=shown.map(h=>action(PREFIX+'slot:'+s.id+':'+day+':'+h,h,'Ver etapa de pagamento'));
  if(times.length>p*7)options.push(action(PREFIX+'hours:'+s.id+':'+day+':'+(p+1),'Mais horários'));
  if(day<dayPlus(today(),31))options.push(action(PREFIX+'hours:'+s.id+':'+dayPlus(day,1)+':1',day===today()?'Ver amanhã':'Próximo dia'));options.push(paymentsButton());
  return reply(safe(s.nome)+' · '+day.split('-').reverse().join('/')+'\n'+(shown.length?'Horários disponíveis agora: '+shown.join(', ')+'.':'Não há horários livres nesta página ou data.')+'\nConsultar ou escolher nesta demonstração não faz uma reserva.',options);}
 const method=t.match(/^saintsai:demo:payment:([a-z_]+)$/);if(method){const {options}=await paymentOptions(lojaId),opt=options.find(x=>x.id===method[1]);return opt?reply(opt.nome+' está disponível nesta loja. Aqui você está só conhecendo o fluxo; nenhuma cobrança ou agendamento foi criado. O pagamento real depende da confirmação do atendimento e da sua escolha.',[paymentsButton(),servicesButton()]):reply('Essa forma de pagamento não está disponível nesta loja.',[paymentsButton()]);}
 return reply('Essa opção não está mais disponível. Consulte as opções atuais.',[servicesButton(),paymentsButton()]);}
async function tentar(evento){if(evento?.fromMe===true||!evento?.idExterno)return false;const text=lerId(evento.texto)||String(evento.texto||'');if(!topic(text))return false;
 const cfgs=await query(db.from('whatsapp_configuracoes').select('id,loja_id,provedor,identificador_externo').eq('identificador_externo',evento.destinatarioId).eq('ativo',true).limit(2));if(cfgs?.length!==1)return false;const w=cfgs[0];
 const owner=await query(db.from('lojas').select('dono_id').eq('id',w.loja_id).maybeSingle());if(!process.env.SAINTSAI_OWNER_USER_ID||owner?.dono_id!==process.env.SAINTSAI_OWNER_USER_ID)return false;
 const c=await query(db.from('saintsai_sales_conversations').select('id,ativo,pausa_humana,briefing,ultimo_evento_id').eq('loja_id',w.loja_id).eq('session_id',evento.destinatarioId).eq('contato',evento.contato).maybeSingle());if(!c?.ativo||c.pausa_humana||c.briefing?.__sales_stop||c.briefing?.__sales_context_suspended||c.briefing?.__sales_wait_human||!/^prospeccao:(aberto|iniciado):/.test(c.ultimo_evento_id||''))return false;
 const idem=require('./whatsappIdempotencia.service'),key={provedor:w.provedor,idExterno:'live-demo:'+evento.destinatarioId+':'+evento.idExterno};if(!await idem.reservarEventoWhatsapp(key))return true;
 let sending=false;try{const result=await answer(w.loja_id,text);if(!result)return false;const mensagem={canal:'whatsapp',lojaId:w.loja_id,configuracaoId:w.id,contato:evento.contato,texto:text,idExterno:key.idExterno,timestamp:evento.timestamp||new Date().toISOString()};sending=true;const sent=await require('./whatsappEnvio.service').enviarRespostaWhatsapp(mensagem,{lojaId:w.loja_id,contato:evento.contato,idExterno:key.idExterno,...result},{provedor:w.provedor,destinatarioId:evento.destinatarioId});if(sent?.status!=='enviado')throw Error('live_demo_delivery_unconfirmed');await idem.concluirEventoWhatsapp(key);return true;}catch(e){if(!sending)await idem.liberarEventoWhatsapp(key);throw e;}}
module.exports={tentar,answer,topic,paymentOptions};
