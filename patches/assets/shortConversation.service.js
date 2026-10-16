'use strict';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim().replace(/^n (?=quero|tenho|entendi|preciso)/,'nao ');
function scopedRefusal(v){const s=norm(v);return /\bnao (?:quero|preciso|vou|posso|gostaria de)\s+(?:(?:mais|esse|essa|este|esta|o|a|um|uma|de|por|pelo|pela)\s+)*(?:pagar|pagamento|pix|cartao|dinheiro|audio|voz|video|foto|imagem|horario|dia|servico|produto|corte|barba|agendar|cancelar)\b/.test(s)&&!/\b(?:nao tenho interesse|nao quero (?:mais |o |esse |seu )?(?:saintsai|sistema|agente|contratar|continuar)|nao me (?:mande|chame)|me deixa em paz|pare de (?:mandar|enviar))\b/.test(s);}
function strongStop(v){return /\b(?:me (?:deixa|deixe) em paz|nao (?:enche|encha)|sai fora|some daqui|nao me (?:perturbe|incomode)|chega de mensagem|tira meu (?:numero|contato)|retira meu (?:numero|contato)|remova meu (?:numero|contato)|cancela esse papo|foda se)\b/.test(norm(v))||/^(?:pare|para|parar|chega|some|suma|encerra|encerre)$/.test(norm(v));}
function kind(v){const s=norm(v);if(strongStop(v))return 'stop';if(scopedRefusal(v))return 'option_no';
 if(/^(?:fala logo|vai direto ao ponto|direto ao ponto|sem enrolacao|resuma|resume|seja breve|que (?:merda|porra) e (?:essa|isso)|o que vc quer|o que voce quer|oq vc quer|oq quer|que quer)$/.test(s))return 'brief';
 if(/^(?:nao entendi|n entendi|como assim|que|q|hein|como|explica|explica melhor)$/.test(s)||/^[?？]+$/.test(String(v||'').trim()))return 'clarify';
 if(/^(?:nao vejo vantagem|qual a vantagem|e dai|ja tenho um sistema|ja tenho sistema|ja uso outro|ja tenho bot|ja resolvo isso)$/.test(s))return 'objection';
 if(/^(?:caro|muito caro|ta caro|caro demais|caro pra (?:mim|caralho)|sem grana|to sem dinheiro)$/.test(s))return 'price_objection';
 if(/^(?:agora nao|hoje nao|depois|outra hora|to ocupado|estou ocupado|sem tempo|nao posso agora|nao da agora)$/.test(s))return 'later';
 if(/^(?:nao|n|negativo|nem)$/.test(s))return 'no';
 if(/^(?:sim|s|ss|pode|pode sim|manda|mostra)$/.test(s))return 'yes';
 if(/^(?:esse|essa|isso|aquele|aquela|o segundo|a segunda|o primeiro|a primeira|1|2|3)$/.test(s))return 'reference';
 if(/^(?:ok|okay|blz|beleza|certo|ta|ta bom|tanto faz|sei|aham|uhum|hm+|hum+|entendi|legal|👍|👌)$/.test(s)||/^(?:👍|👌)[\uFE0F]*$/.test(String(v||'').trim()))return 'ack';return null;}
function lastAssistant(history){if(Array.isArray(history))return [...history].reverse().find(m=>m?.role==='assistant')?.content||'';return String(history||'').split(/\n(?=Cliente:|Vendedor SaintsAI:)/).filter(x=>x.startsWith('Vendedor SaintsAI:')).pop()||'';}
const GUIDANCE='RESPOSTAS CURTAS E DIFÍCEIS: texto seco, palavrão ou falta de entusiasmo não comprovam recusa. Não dê sermão nem imite agressividade. “Tá”, “hm” e emoji não autorizam cadastro, cobrança, reserva ou cancelamento. Um “não” depende da última pergunta; recusar Pix, áudio ou um horário não significa recusar toda a proposta. “Me deixa em paz”, “não enche” e “pare” encerram a abordagem. Quem está sem tempo não recebe pressão nem lembrete automático. Pergunta direta sobre preço deve receber preço confirmado e condições, sem esconder taxas. Mensagem curta não é convite para reiniciar uma apresentação ou despejar catálogo.';
function owner(text,history){const k=kind(text),last=norm(lastAssistant(history));
 if(k==='brief')return 'O SaintsAI ajuda a responder clientes e organizar pedidos ou agendamentos pelo WhatsApp, usando os dados do negócio.';
 if(k==='ack')return 'Certo. Se quiser esclarecer algum ponto, pode perguntar.';
 if(k==='later')return 'Tudo bem, podemos deixar por aqui. Se quiser retomar depois, é só chamar.';
 if(k==='no'){if(/quem cuida|voce (?:que |quem )?cuida|e (?:vc|voce) quem/.test(last))return 'Certo. Quem cuida dessa parte por aí?';if(/posso|quer (?:ver|conhecer|saber)|pode (?:explicar|mostrar)/.test(last))return 'Tudo bem, não vou insistir.';return 'Entendi. Esse não é sobre qual parte da minha última mensagem?';}
 if(k==='yes'){if(/quem cuida|(?:vc|voce) quem cuida|posso (?:te )?explicar|quer (?:ver|conhecer|saber)/.test(last))return 'O SaintsAI ajuda no atendimento pelo WhatsApp enquanto você está ocupado, usando os dados do negócio.';return 'Certo. Você quer que eu explique qual parte?';}
 if(k==='reference')return 'Qual opção você quis dizer? Só quero confirmar antes de seguir.';
 if(k==='clarify')return 'O SaintsAI usa as informações do negócio para responder clientes no WhatsApp. Qual parte da última mensagem você quer esclarecer?';
 if(k==='option_no')return /pagar|pagamento|pix|cartao|dinheiro/.test(norm(text))?'Tudo bem. Conhecer o funcionamento não exige pagar agora; uma cobrança depende da sua escolha e confirmação.':'Tudo bem, essa opção fica de fora. O que você prefere ver?';
 if(k==='price_objection')return 'Entendo. O valor precisa fazer sentido para a sua rotina. Posso esclarecer o que está incluído, sem compromisso.';
 if(k==='objection')return 'Certo. Só faz sentido comparar se houver algo que você queira melhorar no atendimento; não precisa trocar o que já funciona.';
 return null;}
function tenant(text,history){const k=kind(text);if(k==='stop'||k==='later')return 'Tudo bem, podemos deixar por aqui. Se precisar, é só chamar.';
 if(k==='brief')return 'Claro. Me diga o que você precisa e vou direto ao ponto.';
 if(k==='ack')return 'Certo. Se precisar de algo mais, é só me dizer.';
 if(k==='no'||k==='option_no')return 'Tudo bem. Você prefere outra opção ou quer encerrar por aqui?';
 if(k==='yes'||k==='reference')return 'Qual opção você quer escolher? Preciso confirmar antes de seguir.';
 if(k==='price_objection')return 'Entendo. Você quer consultar outra opção disponível?';return null;}
module.exports={norm,kind,scopedRefusal,strongStop,lastAssistant,owner,tenant,GUIDANCE};
