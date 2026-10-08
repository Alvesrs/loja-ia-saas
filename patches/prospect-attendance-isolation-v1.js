const fs=require('node:fs');
function edit(file,fn){fs.writeFileSync(file,fn(fs.readFileSync(file,'utf8')));}
function swap(s,a,b){if(!s.includes(a))throw Error('Missing attendance anchor: '+a.slice(0,80));return s.replace(a,b);}
fs.copyFileSync('patches/assets/owner-sales-policy.js','src/services/ownerSalesPolicy.js');
fs.copyFileSync('patches/assets/owner-sales-automation.service.js','src/services/ownerSalesAutomation.service.js');
edit('src/services/ownerSalesPrompt.js',s=>swap(s,'function relacionadaAoSaintsai(v){const s=normalizar(v);',"function relacionadaAoSaintsai(v){if(require('./ownerSalesPolicy').foraDoEscopo(v))return false;const s=normalizar(v);"));
edit('src/services/whatsappAtendente.service.js',s=>{
 const start=s.indexOf('    const vendaAtiva = await salesSeller.conversaAtiva(lojaId, contato);');
 const end=s.indexOf('    if (!vendaAtiva) {',start);
 const blockEnd=s.indexOf('\n\n    if (!vendaAtiva) {',end+10);
 if(start<0||end<0||blockEnd<0)throw Error('Missing seller routing block');
 const routing=s.slice(start,blockEnd);s=s.slice(0,start)+s.slice(blockEnd);
 s=swap(s,"  if(!await require('./ownerProspecting.service').permitido(lojaId,contato))return null;", "  if(!await require('./ownerProspecting.service').permitido(lojaId,contato))return null;\n"+routing);
 s=swap(s,"    const automacao=await require('./ownerSalesAutomation.service').analisar({lojaId,contato,pergunta:texto});","    const automacao=vendaAtiva?await require('./ownerSalesAutomation.service').analisar({lojaId,contato,pergunta:texto}):null;");
 s=swap(s,'  const respostaAgenda = await agendaWhatsapp.tentarResponder(mensagem);','  const respostaAgenda = vendaAtiva ? null : await agendaWhatsapp.tentarResponder(mensagem);');
 // A scoped silence from the sales agent must not be replaced by an unsolicited audio pitch.
 s=s.replace(/    if \(vendaAtiva && \(resposta === null[\s\S]*?\n    }\n\n(?=    if \(vendaAtiva)/,'');
 s=swap(s,'return Object.freeze({ lojaId, contato, idExterno, pergunta: texto, resposta });',"return Object.freeze({ lojaId, contato, idExterno, pergunta: texto, resposta, ...(vendaAtiva&&resposta===require('./ownerSalesPrompt').RESPOSTA_RECUSA?{salesRefusal:true}:{}) });");
 return s;
});
edit('src/services/salesSeller.service.js',s=>{
 s=swap(s,"  if(!contextoComercial&&!require('./ownerSalesPrompt').relacionadaAoSaintsai(pergunta)){", "  const leadAtual=await obterLead(lojaId,contato);\n  const briefingValido=require('./ownerSalesPolicy').respostaBriefingValida(pergunta,leadAtual);\n  if(require('./ownerSalesPolicy').foraDoEscopo(pergunta)||(!contextoComercial&&!briefingValido&&!require('./ownerSalesPrompt').relacionadaAoSaintsai(pergunta))){");
 s=swap(s,'  const leadAtual=await obterLead(lojaId,contato);\n  if(leadAtual &&', '  if(leadAtual &&');
 s=swap(s,"  if(leadAtual && leadAtual.lead_status==='briefing'){", "  if(leadAtual && leadAtual.lead_status==='briefing'){\n    if(!briefingValido)return require('./businessProfiles.service').fields(CAMPOS_BRIEFING,leadAtual.briefing||{})[Math.max(0,Number(leadAtual.briefing_step||0))]?.pergunta||null;");
 s=swap(s,'    const somenteControle =',"    if(/^\\[(?:SILENCIO|SILENCE)\\]$/.test(marcador))return null;\n    const somenteControle =");
 s=swap(s,'systemPrompt:promptDono||SYSTEM_PROMPT,',"systemPrompt:(promptDono||SYSTEM_PROMPT)+'\\nVocê está na venda do SaintsAI, não no atendimento da empresa prospectada. Não consulte nem ofereça a agenda, os serviços ou o catálogo da loja do dono. Perguntas sobre horários e serviços aqui são sobre as capacidades do SaintsAI. Quando o assunto for alheio, devolva somente [SILENCIO].',");
 return s;
});
edit('src/services/ownerSalesOnboarding.service.js',s=>swap(s.replace('id,ativo,ultimo_evento_id,briefing,prompt_rascunho,lead_status','id,ativo,ultimo_evento_id,briefing,prompt_rascunho,lead_status,briefing_step'),' if(!args.contextoComercial&&!relacionadaAoSaintsai(input)&&!planoValido&&!pagamentoValido)'," if(require('./ownerSalesPolicy').foraDoEscopo(input)||(!args.contextoComercial&&!require('./ownerSalesPolicy').respostaBriefingValida(args.pergunta,c)&&!relacionadaAoSaintsai(input)&&!planoValido&&!pagamentoValido))"));
console.log('Prospecting routes only to the seller; automated replies and briefing context are isolated.');

edit('src/services/whatsappWorker.service.js',s=>{s=swap(s,"if(!await require('./ownerProspecting.service').permitido(mensagem.lojaId,mensagem.contato)){","if(!await require('./ownerProspecting.service').permitido(mensagem.lojaId,mensagem.contato)&&!(resposta.salesRefusal===true&&resposta.resposta===require('./ownerSalesPrompt').RESPOSTA_RECUSA)){");return swap(s,'const voz = resposta.prospectAutomation ?', 'const voz = (resposta.prospectAutomation||resposta.salesRefusal) ?');});
edit('src/controllers/whatsappWahaWebhook.controller.js',s=>{
 const start=s.indexOf('    if (pedidoAudioDireto(evento.texto)) {'),end=s.indexOf('    const reservou = await idempotenciaService.reservarEventoWhatsapp(chaveId);',start);
 if(start<0||end<0)throw Error('Missing direct audio webhook block');
 s=s.slice(0,start)+'    // audio_pela_fila_segura: scope, pause, context and idempotency also apply to audio.\n'+s.slice(end);
 const helperStart=s.indexOf('function pedidoAudioDireto('),helperEnd=s.indexOf('function chaveConversa(',helperStart);
 if(helperStart<0||helperEnd<0)throw Error('Missing direct audio helper');
 return (s.slice(0,helperStart)+s.slice(helperEnd)).replace("const salesVoice = require('../services/salesVoice.service');\n",'');
});
