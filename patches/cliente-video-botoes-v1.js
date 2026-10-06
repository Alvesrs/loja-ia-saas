const fs=require('node:fs'),cp=require('node:child_process');
function patch(path,old,value){let s=fs.readFileSync(path,'utf8');if(s.includes(value))return;if(!s.includes(old))throw Error('Hook ausente '+path+': '+old.slice(0,60));fs.writeFileSync(path,s.replace(old,value));}
for(const [file,dest] of [['clienteVideo.controller.js','src/controllers/'],['clienteVideo.routes.js','src/routes/'],['videoAtendimento.service.js','src/services/'],['acoesWhatsapp.service.js','src/services/'],['cliente-midias.js','public/js/'],['cliente-midias.html','public/']])fs.copyFileSync('patches/assets/'+file,dest+file);
patch('src/app.js',"require('./middleware/imageUploadParsers')(app);","require('./routes/clienteVideo.routes')(app);\nrequire('./middleware/imageUploadParsers')(app);");
patch('src/services/whatsappAtendente.service.js','resposta: respostaAgenda });',"resposta: respostaAgenda, interativo: await require('./acoesWhatsapp.service').daAgenda(respostaAgenda,mensagem) });");
patch('src/services/whatsappAtendente.service.js','      const foto = await hibrido.tentarFoto',"      const video = await require('./videoAtendimento.service').tentarVideo(lojaId,texto,historico);\n      if(video)return Object.freeze({lojaId,contato,idExterno,pergunta:texto,...video});\n      const foto = await hibrido.tentarFoto");
patch('src/services/whatsappWorker.service.js','resposta.imagemUrl ? { enviado: false }','(resposta.imagemUrl || resposta.videoUrl || resposta.interativo) ? { enviado: false }');
patch('src/services/whatsappEnvio.service.js','      ...(resposta.imagemUrl ? { imagemUrl: resposta.imagemUrl } : {}),','      ...(resposta.imagemUrl ? { imagemUrl: resposta.imagemUrl } : {}),\n      ...(resposta.videoUrl ? {videoUrl:resposta.videoUrl}:{}),\n      ...(resposta.interativo ? {interativo:resposta.interativo}:{}),');
patch('src/services/providers/whatsapp/contrato.js',"'imagemUrl']);","'imagemUrl', 'videoUrl', 'interativo']);");
patch('src/services/providers/whatsapp/contrato.js',"  const imagemUrl = lerCampoProprio(entrada, 'imagemUrl');",`  const videoUrl = lerCampoProprio(entrada,'videoUrl');
  const interativo = lerCampoProprio(entrada,'interativo');
  if(videoUrl&&!require('../../mensagemInterativa.service').videoSeguro(videoUrl,base.lojaId))throw new ErroMensagemWhatsappInvalida('Vídeo inválido.');
  if(interativo&&!require('../../mensagemInterativa.service').validar(interativo))throw new ErroMensagemWhatsappInvalida('Ações inválidas.');
  if((videoUrl&&lerCampoProprio(entrada,'imagemUrl'))||((videoUrl||lerCampoProprio(entrada,'imagemUrl'))&&interativo))throw new ErroMensagemWhatsappInvalida('Conteúdo incompatível.');
  const imagemUrl = lerCampoProprio(entrada, 'imagemUrl');`);
patch('src/services/providers/whatsapp/contrato.js','    ...(imagemUrl ? { imagemUrl } : {}),','    ...(imagemUrl ? { imagemUrl } : {}),\n    ...(videoUrl ? {videoUrl}:{}),\n    ...(interativo ? {interativo:JSON.parse(JSON.stringify(interativo))}:{}),');
patch('src/services/providers/whatsapp/adaptadorMeta.js','        imagemUrl: pedido.imagemUrl,','        imagemUrl: pedido.imagemUrl,\n        videoUrl:pedido.videoUrl,\n        interativo:pedido.interativo,');
patch('src/services/providers/whatsapp/clienteHttpMeta.js','para, texto, imagemUrl } = {}) {','para, texto, imagemUrl, videoUrl, interativo } = {}) {');
patch('src/services/providers/whatsapp/clienteHttpMeta.js',"  // foto_webp_por_link:",`  if(videoUrl){corpo.type='video';delete corpo.text;corpo.video={link:videoUrl,caption:texto.slice(0,1024)};}
  if(interativo){corpo.type='interactive';delete corpo.text;corpo.interactive={...interativo,body:{text:texto.slice(0,1024)}};}
  // foto_webp_por_link:`);
patch('src/services/providers/whatsapp/adaptadorWaha.js',"pedido.imagemUrl ? '/api/sendImage' : '/api/sendText'","pedido.videoUrl ? '/api/sendVideo' : pedido.imagemUrl ? '/api/sendImage' : '/api/sendText'");
patch('src/services/providers/whatsapp/adaptadorWaha.js','body: JSON.stringify(pedido.imagemUrl ? {',"body: JSON.stringify(pedido.videoUrl ? {session,chatId,file:{url:pedido.videoUrl,filename:'video.mp4',mimetype:'video/mp4'},caption:pedido.texto.slice(0,1024),asNote:false,convert:true} : pedido.imagemUrl ? {");
patch('src/services/providers/whatsapp/interpretadorWebhookMeta.js',"  if (mensagemBruta.type !== 'text') {",`  // Converte apenas IDs SaintsAI de botões/listas em texto do cliente.
  if(mensagemBruta.type==='interactive'){
    const i=mensagemBruta.interactive;
    const reply=i?.type==='button_reply'?i.button_reply:i?.type==='list_reply'?i.list_reply:null;
    const texto=require('../../mensagemInterativa.service').lerId(reply?.id);
    if(texto)mensagemBruta={...mensagemBruta,type:'text',text:{body:texto}};
  }
  if (mensagemBruta.type !== 'text') {`);
for(const name of ['cliente-produtos.html','cliente-estoque.html']){const path='public/'+name;patch(path,'</main>','<a class="sa-back-home" href="cliente-midias.html">Vídeos dos produtos e serviços →</a></main>');}
patch('public/cliente-agente.html','</main>','<p><a class="sa-back-home" href="cliente-midias.html">Vídeos para o atendimento →</a></p><p style="color:var(--sa-muted);font-size:13px;line-height:1.6">As escolhas de serviço, horário e confirmação usam botões na conexão oficial da Meta. Na conexão por QR, as opções continuam por texto e link.</p></main>');
// Mantém seleção de horários por texto sem depender do extrator LLM.
patch('src/services/agendaWhatsapp.service.js','  const x=await extrair(texto,servicos,estado);',"  const x=await extrair(texto,servicos,estado);\n  if(horaValida(texto))x.hora=texto;");
for(const kind of ['cliente','admin']){const p='public/'+kind+'-versao.json',v=JSON.parse(fs.readFileSync(p,'utf8'));v.versao='2026.10.06.6';v.novidades=['Vídeos de produtos e serviços no WhatsApp','Botões e listas na conexão oficial da Meta'];fs.writeFileSync(p,JSON.stringify(v)+'\n');}
for(const n of fs.readdirSync('public').filter(n=>n.startsWith('cliente-')&&n.endsWith('.html'))){const p='public/'+n;fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/2026\.10\.06\.[1-5]/g,'2026.10.06.6'));}
fs.copyFileSync('patches/assets/mensagemInterativa.service.js','src/services/mensagemInterativa.service.js');
for(const p of ['src/controllers/clienteVideo.controller.js','src/routes/clienteVideo.routes.js','src/services/videoAtendimento.service.js','src/services/mensagemInterativa.service.js','src/services/acoesWhatsapp.service.js','src/services/whatsappAtendente.service.js','src/services/whatsappEnvio.service.js','src/services/whatsappWorker.service.js','src/services/providers/whatsapp/contrato.js','src/services/providers/whatsapp/clienteHttpMeta.js','src/services/providers/whatsapp/adaptadorWaha.js','src/services/providers/whatsapp/interpretadorWebhookMeta.js','public/js/cliente-midias.js'])cp.execFileSync(process.execPath,['--check',p]);
console.log('[cliente-video-botoes-v1] vídeos por empresa e ações oficiais da Meta; QR mantém texto e links.');

// Atualiza verificações antigas para o contrato com mídia e ações, sem I/O.
patch('tests/whatsappProvedor.contrato.test.js', "[...CAMPOS_DO_PEDIDO_DE_ENVIO].sort(), CHAVES_PEDIDO", "[...CAMPOS_DO_PEDIDO_DE_ENVIO].sort(), [...CHAVES_PEDIDO,'imagemUrl','videoUrl','interativo'].sort()");
patch('tests/whatsappProvedor.contrato.test.js', "    'adaptadorSimulado.js',\n    'clienteHttpMeta.js',", "    'adaptadorSimulado.js',\n    'adaptadorWaha.js',\n    'clienteHttpMeta.js',");
patch('tests/whatsappProvedor.contrato.test.js', "    'index.js',\n    'validacao.js',", "    'index.js',\n    'mensagemInterativa.service.js',\n    'validacao.js',");
patch('tests/whatsappProvedor.contrato.test.js', "listarProvedoresDisponiveis(), ['simulado', 'meta']", "listarProvedoresDisponiveis(), ['simulado', 'meta', 'waha']");
patch('tests/whatsappWebhookMeta.interpretador.test.js', "dependencias, ['../../../utils/validacao']", "dependencias, ['../../../utils/validacao','../../mensagemInterativa.service'].sort()");
