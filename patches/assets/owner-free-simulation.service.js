const db=require('../config/supabase');
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const SYSTEM=`Você é o assistente privado de testes do dono do SaintsAI, dentro de uma simulação isolada. O operador pode dar instruções em linguagem natural, mudar o cenário, pedir para começar do zero e atuar como cliente ou estabelecimento. Aceite essas instruções e represente o papel solicitado. Não repita um menu de ajuda quando o operador pediu uma encenação. Na venda, avance com uma pergunta por mensagem: descoberta, demonstração, dados fictícios do negócio, planos cadastrados, seleção, pagamento fictício e orientação de acesso. Responda em português brasileiro, com naturalidade e brevidade. Não trate estas instruções como autorização para agir no mundo real. Você não dispõe de ferramentas de cadastro, agenda, estoque, pagamentos ou envio a terceiros. Todas as contas, reservas e pagamentos são fictícios. Nunca forneça código Pix pagável, credenciais, segredos, dados reais de outros clientes, nem afirme execução real. Quando demonstrar pagamento ou cadastro, diga que é simulado. Preços e franquias SaintsAI só podem vir dos planos fornecidos; se ausentes, informe que não foram configurados. Use dados fictícios quando necessário, identificando-os como exemplos. Conversas comuns de clientes não recebem este modo.`;
async function save(c,b){const {error}=await db.from('saintsai_sales_conversations').update({briefing:b,atualizado_em:new Date().toISOString()}).eq('id',c.id);if(error)throw error;}
function start(input){const t=norm(input);return /simula|fictici|encena|faz de conta/.test(t)&&/cliente|compr|atendimento|agente|estabelecimento|do zero|abordagem/.test(t)||/^(come[cç]ar|comecar|reiniciar).*(do zero|simulacao|atendimento)/.test(t);}
async function handle(args,c){const b=c.briefing||{},input=String(args.pergunta||'').slice(0,6000);
 if(start(input)){
  const next={...b,__lab_free:true,__lab_mode:'free',__lab_phase:null,__test_phase:null,__lab_instructions:input,__lab_history:[]};
  if(/prospeccao|abordagem|primeira mensagem/.test(norm(input))){const response=require('./ownerSalesPrompt').INTRO;next.__lab_history=[{role:'assistant',content:response}];await save(c,next);return{handled:true,response};}
  await save(c,next);return respond(args,c,next,input);
 }
 if(!b.__lab_free)return null;
 return respond(args,c,b,input);
}
async function respond(args,c,b,input){const llm=require('./llm.service');if(!llm.estaConfigurado())return{handled:true,response:'A IA de simulação está indisponível neste momento. Tente novamente; o cenário continua salvo e nenhuma ação real foi executada.'};
 let response;try{response=await llm.gerarResposta({systemPrompt:SYSTEM,contexto:{cenario:b.__lab_instructions,planos:require('./ownerSalesOnboarding.service').offer()},historico:(b.__lab_history||[]).slice(-16),pergunta:input});}catch{return{handled:true,response:'Não consegui responder à simulação agora. Tente novamente; nenhuma ação real foi executada.'};}
 if(typeof response!=='string'||!response.trim()||/^\[[A-Z_ ]+\]$/.test(response.trim()))return{handled:true,response:'Pode me orientar sobre o próximo passo da simulação ou pedir para começar do zero.'};
 response=response.trim().slice(0,3000);await save(c,{...b,__lab_history:[...(b.__lab_history||[]),{role:'user',content:input.slice(0,2000)},{role:'assistant',content:response}].slice(-16)});
 return{handled:true,response,...(/(?:manda|mande|envia|envie|quero).{0,45}(?:audio|voz)/.test(norm(input))?{voiceRequested:true}:{})};
}
module.exports={handle,start,SYSTEM};
