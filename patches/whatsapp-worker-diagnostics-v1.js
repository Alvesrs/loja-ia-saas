const fs = require('node:fs');
const cp = require('node:child_process');
const path = 'src/services/whatsappWorker.service.js';
let worker = fs.readFileSync(path, 'utf8');

function replace(oldText, newText) {
  if (!worker.includes(oldText)) throw new Error('Worker hook ausente: ' + oldText.slice(0, 50));
  worker = worker.replace(oldText, newText);
}

replace('  const contexto = contextoDoJob(job);\n\n  try {',
  "  const contexto = contextoDoJob(job);\n  let etapa = 'historico_entrada';\n\n  try {");
replace('      const situacaoPlano = await assinaturas.obterSituacaoPlano(mensagem.lojaId);',
  "      etapa = 'plano';\n      const situacaoPlano = await assinaturas.obterSituacaoPlano(mensagem.lojaId);");
replace('      const resposta = await atendente.responderMensagemWhatsapp(mensagem);',
  "      etapa = 'atendente';\n      const resposta = await atendente.responderMensagemWhatsapp(mensagem);");
replace('      const voz = await salesVoice.enviarSeAplicavel(mensagem, resposta, contexto);',
  "      etapa = 'voz';\n      const voz = await salesVoice.enviarSeAplicavel(mensagem, resposta, contexto);");
replace('        await envio.enviarRespostaWhatsapp(mensagem, resposta, contexto);',
  "        etapa = 'envio';\n        await envio.enviarRespostaWhatsapp(mensagem, resposta, contexto);");
replace('      await fila.marcarJobEnviado(job.id, resposta.resposta);',
  "      etapa = 'marcar_enviado';\n      await fila.marcarJobEnviado(job.id, resposta.resposta);");
replace('    await historico.registrarMensagemEnviada(mensagem, respostaFinal, contexto);',
  "    etapa = 'historico_saida';\n    await historico.registrarMensagemEnviada(mensagem, respostaFinal, contexto);");
replace('  } catch (erro) {\n    // Se o envio foi confirmado',
  "  } catch (erro) {\n    console.error('[whatsapp.worker] job_falhou', { jobId: job.id, etapa, tipo: erro?.name || 'Error', codigo: erro?.code || null });\n    // Se o envio foi confirmado");
fs.writeFileSync(path, worker);

const attendeePath = 'src/services/whatsappAtendente.service.js';
let attendee = fs.readFileSync(attendeePath, 'utf8');
const oldLog = "console.error('[whatsappAtendente] falha ao gerar a resposta interna. Tipo do erro:', (erro && erro.name) || 'desconhecido');";
if (!attendee.includes(oldLog)) throw new Error('Atendente hook ausente');
attendee = attendee.replace(oldLog,
  "console.error('[whatsappAtendente] falha_interna', { tipo: erro?.name || 'Error', codigo: erro?.code || null });");
fs.writeFileSync(attendeePath, attendee);
cp.execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
cp.execFileSync(process.execPath, ['--check', attendeePath], { stdio: 'inherit' });
