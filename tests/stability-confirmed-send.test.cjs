'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function fixture(failure) {
  const calls = [];
  const response = { resposta: 'Resposta de teste' };
  const fila = { STATUS: { ENVIADO: 'enviado' }, ErroFilaWhatsapp: class extends Error {},
    marcarJobEnviado: async () => { calls.push('persist'); if (failure === 'persist') throw Error('db'); },
    concluirJob: async () => calls.push('done'),
    reagendarFinalizacaoJob: async j => { calls.push('finalize-retry'); assert.equal(j.status, 'enviado'); assert.equal(j.resposta_texto, response.resposta); },
    reagendarOuFalharJob: async () => calls.push('send-retry') };
  const deps = {
    './whatsappFila.service': fila,
    './whatsappHistorico.service': { registrarMensagemRecebida: async () => {}, registrarMensagemEnviada: async () => { if (failure === 'history') throw Error('db'); }, ErroHistoricoWhatsapp: class extends Error {} },
    './whatsappAtendente.service': { responderMensagemWhatsapp: async () => response },
    './whatsappEnvio.service': { enviarRespostaWhatsapp: async () => { calls.push('send'); if (failure === 'send') throw Error('provider'); }, ErroEnvioWhatsapp: class extends Error {} },
    './whatsappIdempotencia.service': { concluirEventoWhatsapp: async () => {}, ErroIdempotenciaBanco: class extends Error {} },
    './assinaturas.service': { obterSituacaoPlano: async () => ({ ativo: true }) },
    './salesVoice.service': { enviarSeAplicavel: async () => ({ enviado: false }) },
    './agendaLembretes.service': {}, './asaasAgendamentoPix.service': {},
    './ownerMinuteHandoff.service': { before: async () => 'ready', canSend: async () => true },
    './ownerSellerTest.service': { stale: async () => false },
    './ownerProspecting.service': { permitido: async () => true },
    './ownerSalesMediaClean.service': { clean: v => v }, './pixCopyMessage.service': { clean: v => v }
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync('src/services/whatsappWorker.service.js', 'utf8'), {
    module, require: name => { assert(name in deps, name); return deps[name]; },
    console: { error() {} }, Date, Object, String, Number, process: { env: {} }
  });
  return { calls, worker: module.exports };
}
const job = { id: 'synthetic', status: 'processando', texto: 'teste', loja_id: 'tenant', contato: 'synthetic', id_externo: 'synthetic' };
for (const failure of ['persist', 'history']) test('confirmed send with ' + failure + ' failure retries only finalization', async () => {
  const f = fixture(failure);
  assert.equal((await f.worker.processarJob(job)).ok, false);
  assert.equal(f.calls.filter(v => v === 'send').length, 1);
  assert(f.calls.includes('finalize-retry'));
  assert(!f.calls.includes('send-retry'));
});
test('already sent job performs no external send', async () => {
  const f = fixture();
  assert.equal((await f.worker.processarJob({ ...job, status: 'enviado', resposta_texto: 'Confirmada' })).ok, true);
  assert(!f.calls.includes('send'));
});
test('active marked conversation keeps agent before opening completes; only standalone star takes over', () => {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync('src/services/ownerStarControl.service.js', 'utf8'), { module, require: () => ({}), String, Date, Number });
  const c = { ativo: true, ultimo_evento_id: 'prospeccao:iniciado:synthetic', briefing: {} };
  for (const text of ['Olá', 'olá *']) assert.equal(module.exports.mode(c, { fromMe: true, source: 'app', texto: text }), 'agent');
  assert.equal(module.exports.mode(c, { fromMe: true, source: 'app', texto: ' * ' }), 'takeover');
});
