'use strict';
const fs=require('node:fs');
const file='src/controllers/whatsappWahaWebhook.controller.js';
let s=fs.readFileSync(file,'utf8');
const old=`    const reservou = await idempotenciaService.reservarEventoWhatsapp(chaveId);
    if(!reservou) return res.status(200).json({status:'duplicado_ignorado'});

    const renovacaoTratada = await renovacaoService.processarMensagemDono(evento);
    if(renovacaoTratada) return res.status(200).json({status:'renovacao_processada'});

    // stability: acknowledgment only after durable grouped enqueue
    const durable = require('../services/whatsappDurableBatch.service');
    if (durable.enabled()) {
      const interna = await webhookService.processarEventoWhatsapp(evento, CONTEXTO);
      await durable.enqueue(interna, evento, janelaAgrupamentoMs());
      return res.status(200).json({status:'recebido_agrupando'});
    }`;
const updated=`    const durable = require('../services/whatsappDurableBatch.service');
    if (durable.enabled() && !await renovacaoService.contextoRenovacaoAtivo(evento)) {
      const interna = await webhookService.processarEventoWhatsapp(evento, CONTEXTO);
      const stored = await durable.enqueue(interna, evento, janelaAgrupamentoMs());
      return res.status(200).json({status:stored.created?'recebido_agrupando':'duplicado_ignorado'});
    }
    // Renewal has a separate side-effectful protocol. Keep its existing reservation path.
    const reservou = await idempotenciaService.reservarEventoWhatsapp(chaveId);
    if(!reservou) return res.status(200).json({status:'duplicado_ignorado'});
    reservaLegadaCriada = true;
    const renovacaoTratada = await renovacaoService.processarMensagemDono(evento);
    if(renovacaoTratada) return res.status(200).json({status:'renovacao_processada'});`;
if(!s.includes('const stored = await durable.enqueue')){
 if(!s.includes(old))throw Error('WAHA atomic anchor missing');
 s=s.replace('  const chaveId={provedor:\'waha\',idExterno:evento.idExterno};','  const chaveId={provedor:\'waha\',idExterno:evento.idExterno};\n  let reservaLegadaCriada = false;');
 s=s.replace(old,updated);
 s=s.replace('    try{await idempotenciaService.liberarEventoWhatsapp(chaveId);}catch(_){}','    if(reservaLegadaCriada)try{await idempotenciaService.liberarEventoWhatsapp(chaveId);}catch(_){}');
 fs.writeFileSync(file,s);
}
const rfile='src/services/renovacao.service.js';s=fs.readFileSync(rfile,'utf8');
if(!s.includes('async function contextoRenovacaoAtivo(evento)')){
 const anchor='module.exports={verificarRenovacoes,processarMensagemDono,confirmarPagamento,iniciarAgendadorRenovacao};';
 if(!s.includes(anchor))throw Error('Renewal export anchor missing');
 s=s.replace(anchor,`async function contextoRenovacaoAtivo(evento){
 const ctx=await contextoDono(evento);
 if(!ctx)return false;
 return ctx.sessao.estado!=='adiado'||/(renov|plano|pagar|pix)/i.test(String(evento.texto||''));
}
module.exports={verificarRenovacoes,processarMensagemDono,confirmarPagamento,iniciarAgendadorRenovacao,contextoRenovacaoAtivo};`);
 fs.writeFileSync(rfile,s);
}
