'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {GUIDANCE,parts,send}=require('../patches/assets/conversationRhythm.service.js');
test('guidance must prioritize last customer request and conversation history',()=>{
 assert.match(GUIDANCE,/última intenção/);
 assert.match(GUIDANCE,/últimas trocas/);
 assert.match(GUIDANCE,/não faça nova apresentação/);
});
test('guidance does not imply agent is human',()=>{
 assert.match(GUIDANCE,/assistente virtual/);
 assert.match(GUIDANCE,/não deve se passar por uma pessoa real/);
});
test('guidance preserves operational truth',()=>{
 assert.match(GUIDANCE,/não confirme reserva/i);
 assert.match(GUIDANCE,/exatamente como confirmados/);
 assert.match(GUIDANCE,/Nunca invente promoções/);
});
test('no image generation for customer product photos',()=>{
 assert.match(GUIDANCE,/material real autorizado/);
 assert.match(GUIDANCE,/Nunca envie imagens geradas por IA/);
});
test('transactional link/code is never split or altered',()=>{
 const value='Pagamento confirmado? Não. Link de checkout https://exemplo.org/pagar. Código Pix: 00020126360014BR.GOV.BCB.PIX. Consulte o status antes de afirmar qualquer coisa.';
 const result=parts({resposta:value,salesDialogue:true}); assert.deepEqual(result,[value]);
});
test('interactive and media replies remain intact',()=>{
 const text='Escolha entre os serviços informados na lista. Depois selecione um horário disponível. O pagamento acontece apenas quando a operação informar que foi concluída.';
 assert.deepEqual(parts({resposta:text,tenantDialogue:true,interativo:[{label:'Corte'}]}),[text]);
});
test('off-topic controls do not get expanded or split',()=>{
 assert.deepEqual(parts({resposta:'[SILENCIO]',salesDialogue:true}),['[SILENCIO]']);
});
test('split a genuinely long, eligible response at most twice',()=>{
 const value='A gente consegue tirar essa dúvida com as informações cadastradas no negócio. Primeiro, confirme qual serviço você procura. Depois consultamos os horários que realmente estão disponíveis. Se preferir, podemos transferir seu atendimento para uma pessoa da equipe.';
 const a=parts({resposta:value,tenantDialogue:true}); assert.ok(a.length<=2);assert.equal(a.join(' ').replace(/\s+/g,' ').trim(),value);
});
test('single response still uses original sender only once',async()=>{
 let count=0;
 await send({job:{},mensagem:{},resposta:{resposta:'Tudo bem, o pedido ainda não foi confirmado.',salesDialogue:true},contexto:{},enviar:async()=>{count++;}});
 assert.equal(count,1);
});
