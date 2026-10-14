'use strict';const fs=require('node:fs');
fs.copyFileSync('patches/assets/whatsappDurableBatch.service.js','src/services/whatsappDurableBatch.service.js');
const path='src/controllers/whatsappWahaWebhook.controller.js';let s=fs.readFileSync(path,'utf8');
const anchor='    const chave = chaveConversa(evento);';
const block=`    // stability: acknowledgment only after durable grouped enqueue
    const durable = require('../services/whatsappDurableBatch.service');
    if (durable.enabled()) {
      const interna = await webhookService.processarEventoWhatsapp(evento, CONTEXTO);
      await durable.enqueue(interna, evento, janelaAgrupamentoMs());
      return res.status(200).json({status:'recebido_agrupando'});
    }

`;
if(!s.includes('// stability: acknowledgment only after durable grouped enqueue')){if(!s.includes(anchor))throw Error('WAHA batch anchor missing');fs.writeFileSync(path,s.replace(anchor,block+anchor));}
