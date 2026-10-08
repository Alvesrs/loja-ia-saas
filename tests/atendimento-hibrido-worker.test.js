const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const calls = [];
let resposta = null,permitido=true,stale=false;
function mock(name, exports) {
  const file = path.resolve(__dirname, '../src/services/' + name + '.service.js');
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
mock('whatsappFila', { STATUS: { ENVIADO: 'enviado' }, concluirJob: async () => calls.push('concluir'), marcarJobEnviado: async () => calls.push('marcar'), reagendarOuFalharJob: async () => calls.push('retry'), reagendarFinalizacaoJob: async () => calls.push('retry-final'), ErroFilaWhatsapp: class extends Error {} });
mock('whatsappHistorico', { registrarMensagemRecebida: async () => calls.push('entrada'), registrarMensagemEnviada: async () => calls.push('saida'), ErroHistoricoWhatsapp: class extends Error {} });
mock('whatsappAtendente', { responderMensagemWhatsapp: async () => resposta });
mock('whatsappEnvio', { enviarRespostaWhatsapp: async (_, r) => { if(!r.salesRefusal&&!r.prospectAutomation)assert.equal(r.imagemUrl, 'https://example.supabase.co/foto.jpg'); calls.push('enviar'); }, ErroEnvioWhatsapp: class extends Error {} });
mock('whatsappIdempotencia', { concluirEventoWhatsapp: async () => calls.push('idempotencia'), ErroIdempotenciaBanco: class extends Error {} });
mock('assinaturas', { obterSituacaoPlano: async () => ({ ativo: true }) });
mock('salesVoice', { enviarSeAplicavel: async () => { calls.push('voz'); return { enviado: false }; } });
mock('ownerProspecting', {permitido:async()=>permitido});
mock('ownerSellerTest', {stale:async()=>stale});
mock('ownerSalesPrompt', {RESPOSTA_RECUSA:'Agradeço por responder. Tenha um ótimo dia!'});
mock('agendaLembretes', {});
mock('asaasAgendamentoPix', {});
const worker = require('../src/services/whatsappWorker.service');
const job = { id: 'job1', loja_id: 'loja1', configuracao_id: 'cfg1', contato: '5511999999999', texto: 'foto', id_externo: 'msg1', provedor: 'waha', destinatario_id: 'empresa', status: 'processando' };

test('silêncio conclui fila e idempotência sem enviar ou agendar nova tentativa', async () => {
  calls.length = 0; resposta = null;
  const r = await worker.processarJob(job);
  assert.equal(r.silencioso, true);
  assert.deepEqual(calls, ['entrada', 'idempotencia', 'concluir']);
});
test('foto passa por um único envio e não é trocada por áudio', async () => {
  calls.length = 0; resposta = { lojaId: job.loja_id, contato: job.contato, idExterno: job.id_externo, resposta: 'Camisa · R$ 80,00', imagemUrl: 'https://example.supabase.co/foto.jpg' };
  const r = await worker.processarJob(job);
  assert.equal(r.ok, true);
  assert.deepEqual(calls, ['entrada', 'enviar', 'marcar', 'saida', 'idempotencia', 'concluir']);
});
test('retry de um job já enviado só finaliza, sem reenviar a foto', async () => {
  calls.length = 0;
  const r = await worker.processarJob({ ...job, status: 'enviado', resposta_texto: 'Camisa · R$ 80,00' });
  assert.equal(r.ok, true);
  assert.deepEqual(calls, ['saida', 'idempotencia', 'concluir']);
});

test('recusa agradece uma vez mesmo após desativar a prospecção, sem áudio',async()=>{
 calls.length=0;permitido=false;resposta={salesRefusal:true,resposta:'Agradeço por responder. Tenha um ótimo dia!'};
 const r=await worker.processarJob(job);assert.equal(r.ok,true);assert.deepEqual(calls,['entrada','enviar','marcar','saida','idempotencia','concluir']);permitido=true;
});
test('pausa manual bloqueia resposta comercial que já estava sendo preparada',async()=>{
 calls.length=0;permitido=false;resposta={resposta:'Proposta comercial'};
 const r=await worker.processarJob(job);assert.equal(r.silencioso,true);assert.deepEqual(calls,['entrada','idempotencia','concluir']);permitido=true;
});
test('comparação com atendimento automático nunca envia áudio adicional',async()=>{
 calls.length=0;resposta={prospectAutomation:true,resposta:'O atendimento automático resolve bem?'};
 const r=await worker.processarJob(job);assert.equal(r.ok,true);assert(!calls.includes('voz'));assert.equal(calls.filter(x=>x==='enviar').length,1);
});
test('teste reiniciado descarta jobs antigos sem envio',async()=>{
 calls.length=0;stale=true;const r=await worker.processarJob(job);assert.equal(r.silencioso,true);assert.deepEqual(calls,['entrada','idempotencia','concluir']);stale=false;
});
