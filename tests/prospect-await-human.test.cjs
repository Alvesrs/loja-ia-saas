'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const wait=require('../patches/assets/ownerProspectWait.service');
const prompt=require('../src/services/ownerSalesPrompt');
const notices=[
 'Olá, ficamos felizes em receber a sua mensagem! Nossa prioridade é te ajudar. Em breve um membro da nossa equipe irá te atender. Mas enquanto isso gostaria de compartilhar o motivo da sua mensagem? Caso seja urgente, pedimos que entre em contato via ligação.',
 'Olá! Agradecemos a sua mensagem. No momento não estamos disponíveis. O nosso atendimento é de segunda a sexta das 7:00h às 12:00h e de 14:00h às 17:00h. Aos sábados das 07h00 às 11h00. Assim que possível, responderemos a sua mensagem. Atenciosamente, Clínica Exemplo.',
 'No momento não estou disponível para responder. Retorno depois.',
 'Assim que possível responderemos sua mensagem.',
 'Em breve nossa equipe vai te responder.',
 'Aguarde um momento, nosso atendente irá responder.'
];
for(const text of notices)test('wait notice is not a sales refusal: '+text.slice(0,60),()=>{assert.equal(wait.waiting(text),true);assert.equal(prompt.recusou(text),false);});
for(const text of ['Agora não','No momento não','Por enquanto não','Não quero contratar','Não tenho interesse','Não, obrigado','Não me envie mais mensagens','No momento não estamos disponíveis. Não quero receber propostas.','Em breve nossa equipe vai te responder. Pare de mandar mensagens.','naum kero','n quero'])test('actual refusal remains authoritative: '+text,()=>assert.equal(prompt.recusou(text),true));
for(const text of ['Olá, como posso te ajudar?','Como funciona o SaintsAI?','Vocês atendem fora do horário?','Não estamos disponíveis para uma reunião, mas quero saber o preço','Minha equipe vai atender os clientes com o SaintsAI?'])test('normal human turn is not swallowed: '+text,()=>assert.equal(wait.waiting(text),false));
