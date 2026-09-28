const fs = require('node:fs');
const cp = require('node:child_process');
function patch(path, oldText, newText) {
  const s = fs.readFileSync(path, 'utf8');
  if (!s.includes(oldText)) throw new Error('Hook ausente em ' + path + ': ' + oldText.slice(0, 60));
  fs.writeFileSync(path, s.replace(oldText, newText));
}

const webhook = 'src/controllers/whatsappWahaWebhook.controller.js';
patch(webhook, 'if (!Number.isFinite(valor)) return 5000;', 'if (!Number.isFinite(valor)) return 10000;');
patch(webhook, 'return Math.max(1500, Math.min(valor, 15000));', 'return Math.max(10000, Math.min(valor, 15000));');
patch(webhook, "  const combinado = Object.freeze({\n    ...ultimo,\n    texto: itens.map((item) => item.texto).filter(Boolean).join('\\n'),\n  });",
  "  const vistos = new Set();\n  const textos = itens.map(item => String(item.texto || '').trim()).filter(texto => {\n    if (!texto) return false;\n    const chave = texto.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/\\s+/g, ' ');\n    if (vistos.has(chave)) return false;\n    vistos.add(chave);\n    return true;\n  });\n  const combinado = Object.freeze({ ...ultimo, texto: textos.join('\\n') });");

const worker = 'src/services/whatsappWorker.service.js';
patch(worker, "      etapa = 'plano';",
  "      // Quando o cliente manda mais mensagens antes da resposta, a mensagem\n      // mais nova responde pelo contexto. A antiga permanece no histórico.\n      if (job.criado_em) {\n        const limite = new Date(new Date(job.criado_em).getTime() + 45000).toISOString();\n        const {data:maisNova,error:erroBusca} = await require('../config/supabase')\n          .from('whatsapp_fila_processamento').select('id')\n          .eq('loja_id', job.loja_id).eq('configuracao_id', job.configuracao_id)\n          .eq('contato', job.contato).neq('id', job.id)\n          .in('status', ['pendente','processando'])\n          .gt('criado_em', job.criado_em).lte('criado_em', limite)\n          .order('criado_em', {ascending:false}).limit(1);\n        if (erroBusca) throw erroBusca;\n        if (maisNova?.length) {\n          await idempotencia.concluirEventoWhatsapp({provedor:job.provedor,idExterno:job.id_externo});\n          await fila.concluirJob(job.id);\n          return Object.freeze({ok:true,id:job.id,agrupadoEm:maisNova[0].id});\n        }\n      }\n      etapa = 'plano';");

const prompt = 'src/services/iaPrompt.service.js';
patch(prompt, '- Não invente memória: use somente o histórico realmente recebido nesta conversa.',
  `- Não invente memória: use somente o histórico realmente recebido nesta conversa.
- Leia a última sequência de mensagens do cliente como um pedido conjunto. Responda uma vez ao pedido mais recente, considerando as informações anteriores que ainda valem.
- Se o cliente pedir para gerar um link, confirmar pagamento, reservar ou executar outra ação, nunca diga que fez isso sem resultado real de uma ferramenta do sistema. Dê o próximo passo concreto disponível.
- Não repita despedidas, ofertas genéricas de ajuda nem perguntas já respondidas. Se a mensagem for apenas uma confirmação breve, avance no assunto em aberto.`);

const agenda = 'src/services/agendaWhatsapp.service.js';
patch(agenda, '  const ativo=Boolean(estado&&estado.ativo);',
  `  const ativo=Boolean(estado&&estado.ativo);
  // Link real de escolha de serviço/horário/Pix. Nunca o chame de cobrança
  // criada: o Pix só é gerado depois das escolhas e validações na página.
  if (/\\b(ger(e|ar)|manda(r)?|envia(r)?)\\b.{0,30}\\b(novo\\s+)?link\\b/i.test(texto)) {
    const [{data:cfg,error:ec},{data:servicos,error:es},{data:pag,error:ep}] = await Promise.all([
      supabase.from('saintsai_agenda_config').select('horarios').eq('loja_id',lojaId).maybeSingle(),
      supabase.from('saintsai_servicos').select('id').eq('loja_id',lojaId).eq('ativo',true).limit(1),
      supabase.from('saintsai_pagamento_config').select('provedor,conectado,aceita_pix_online').eq('loja_id',lojaId).maybeSingle()
    ]);
    if(ec||es||ep)throw ec||es||ep;
    if(cfg?.horarios && servicos?.length && pag?.provedor==='asaas' && pag?.conectado && pag?.aceita_pix_online) {
      const link=await bookingPublic.criarLink({lojaId,contato,clienteNome:estado?.nome||null});
      return 'Aqui está um novo link para escolher o serviço e o horário. Na página, selecione Pix para gerar a cobrança: '+link;
    }
  }`);

for (const path of [webhook,worker,prompt,agenda])
  cp.execFileSync(process.execPath, ['--check',path], {stdio:'inherit'});
