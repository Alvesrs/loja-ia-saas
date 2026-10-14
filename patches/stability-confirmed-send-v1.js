'use strict';
const fs = require('node:fs');
function replace(file, from, to) {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(to)) return;
  if (!source.includes(from)) throw Error('Stability anchor missing: ' + file);
  fs.writeFileSync(file, source.replace(from, to));
}
// Capture the confirmed external effect before any subsequent database operation.
// A database failure must retry finalization, never the WhatsApp send.
replace('src/services/whatsappWorker.service.js',
  "      etapa = 'marcar_enviado';",
  "      job = { ...job, status: fila.STATUS.ENVIADO, resposta_texto: resposta.resposta };\n      etapa = 'marcar_enviado';");
// Finalization retry must persist the response too when the first write failed.
replace('src/services/whatsappFila.service.js',
  "    status: STATUS.ENVIADO,\n    proxima_tentativa_em: proxima,",
  "    status: STATUS.ENVIADO,\n    resposta_texto: job.resposta_texto,\n    proxima_tentativa_em: proxima,");
replace('src/services/whatsappFila.service.js',
  "async function reagendarFinalizacaoJob(job, codigo = 'falha_finalizacao') {",
  "async function reagendarFinalizacaoJob(job, codigo = 'falha_finalizacao') {\n  // Keep confirmed delivery evidence even when retry budget is exhausted.");
const file = 'src/services/whatsappFila.service.js';
let source = fs.readFileSync(file, 'utf8');
const start = source.indexOf('async function reagendarFinalizacaoJob');
const tail = source.slice(start).replace(
  "{ status: STATUS.FALHOU, lease_ate: null, ultimo_erro_codigo: codigoSeguro }",
  "{ status: STATUS.FALHOU, resposta_texto: job.resposta_texto, lease_ate: null, ultimo_erro_codigo: codigoSeguro }");
fs.writeFileSync(file, source.slice(0, start) + tail);
// Active sales conversations do not require a completed opening to honor '*'.
replace('src/services/ownerStarControl.service.js',
  "return c.ativo&&c.briefing?.__sales_opening_done?'agent':null;",
  "return c.ativo?'agent':null;");
