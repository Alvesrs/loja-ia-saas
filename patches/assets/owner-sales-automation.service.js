const supabase=require('../config/supabase');
const prompt=require('./ownerSalesPrompt');
const {norm,foraDoEscopo,respostaBriefingValida}=require('./ownerSalesPolicy');
function respostaCurtaAtendimento(v){return norm(v).length<=90&&/^(?:sim|nao|mais ou menos|as vezes|funciona(?: bem)?|resolve(?: bem)?|atende(?: bem| mal)?|nao atende(?: bem| muito bem)?|nao muito(?: bem)?|podia melhorar|precisa melhorar|so manda(?: o)? link|manda(?: o)? link|so encaminha(?: um)? link|responde(?: bem| mal)?|ja temos (?:um )?(?:bot|atendimento automatico))(?:\b.*)?$/.test(norm(v));}
function respostaAutomatica(v,jaIdentificado=false){
 const raw=String(v||'').trim(),s=norm(raw);if(!s)return false;
 if(/\bnao (?:temos|tem|possui|usamos|uso|utilizo|ha) (?:um |uma )?(?:atendimento automatico|chatbot|bot|robo)\b/.test(s))return false;
 if(/^(?:voces|o agente|o saintsai|ele|funciona|quanto|pode|como (?:funciona|conecto|contrato)|qual (?:o|e o) (?:preco|valor))\b/.test(s)&&raw.includes('?'))return false;
 const template=/\b(?:mensagem|resposta)\s+(?:automatica|automatizada)\b|\b(?:recebemos sua mensagem|agradecemos (?:o|seu) contato|agradece (?:o|seu) contato|obrigad[oa] (?:pelo contato|por entrar em contato)|fora (?:do nosso |do |de )?horario|retornaremos em breve|responderemos (?:em breve|assim que possivel)|entraremos em contato assim que possivel|assim que possivel (?:irei|vamos|iremos) (?:te )?responder|digite (?:uma|um|[0-9])|selecione uma opcao|escolha uma opcao|recepcionista virtual)\b/.test(s);
 if(template)return true;
 // People describing an existing bot and asking about our product are not that bot.
 if(/\b(?:ja tenho|ja temos|uso|usamos|utilizo|utilizamos|meu|nosso)\b.{0,40}\b(?:bot|chatbot|atendimento automatico|assistente virtual)\b/.test(s))return false;
 if(/\b(?:assistente virtual|chatbot|atendimento automatico|atendimento virtual|agente virtual|menu automatico)\b/.test(s))return true;
 if(jaIdentificado&&/^(?:aguarde|so um momento|um momento por favor|estamos direcionando|transferindo|retornaremos|encaminharemos)\b/.test(s))return true;
 const url=/(?:https?:\/\/|www\.|wa\.me\/|bit\.ly\/|linktr\.ee\/)/i.test(raw);
 if(url&&(/\b(?:acesse|clique|confira|consulte|catalogo|cardapio|menu|segue|fale|chame|agende|faca seu pedido)\b/.test(s)||/^https?:\/\/\S+$/.test(raw)||/\bsegue (?:nosso|o) link\b/.test(s)))return true;
 return /\b(?:digite|responda|selecione|escolha)\s+(?:[0-9]|uma opcao|uma das opcoes)\b|\bopcao [0-9]\b/.test(s);
}
async function analisar({lojaId,contato,pergunta}){
 if(prompt.recusou(pergunta))return null;
 const {data,error}=await supabase.from('saintsai_sales_conversations').select('id,ultimo_evento_id,lead_status,briefing_step,briefing').eq('loja_id',lojaId).eq('contato',contato).eq('ativo',true).limit(1).maybeSingle();
 if(error)throw error;if(!data||!/^prospeccao:(?:aberto|iniciado):/.test(data.ultimo_evento_id||''))return null;
 const jaIdentificado=/:autoatendimento$/.test(data.ultimo_evento_id||''),automatica=respostaAutomatica(pergunta,jaIdentificado);
 if(jaIdentificado){
  if(automatica||foraDoEscopo(pergunta))return {silencio:true};
  if(respostaCurtaAtendimento(pergunta)||prompt.relacionadaAoSaintsai(pergunta)||respostaBriefingValida(pergunta,data))return {contextoComercial:true};
  return {silencio:true};
 }
 if(respostaCurtaAtendimento(pergunta))return {contextoComercial:true};
 if(automatica){
  const marcador='prospeccao:iniciado:'+Date.now()+':autoatendimento';
  const {data:claim,error:claimError}=await supabase.from('saintsai_sales_conversations').update({ultimo_evento_id:marcador,atualizado_em:new Date().toISOString()}).eq('id',data.id).eq('ultimo_evento_id',data.ultimo_evento_id).eq('ativo',true).select('id').maybeSingle();
  if(claimError)throw claimError;if(!claim)return {silencio:true};
  return {resposta:'Vi que vocês já têm atendimento automático. Ele resolve bem as dúvidas dos clientes? O SaintsAI pode continuar a conversa com os dados do negócio, além de enviar um link.',prospectAutomation:true};
 }
 return null;
}
module.exports={analisar,respostaAutomatica,respostaCurtaAtendimento};
