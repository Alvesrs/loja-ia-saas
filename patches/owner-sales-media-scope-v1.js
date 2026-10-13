'use strict';const fs=require('fs');
const edit=(f,fn)=>fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8')));
edit('src/services/whatsappAtendente.service.js',s=>s.replace("const productGallery=await require('./galleryProductConsent.service').tentar(mensagem);", "const productGallery=await salesSeller.conversaAtiva(lojaId,contato)?null:await require('./galleryProductConsent.service').tentar(mensagem);"));
edit('src/services/ownerSalesAutomation.service.js',s=>s.replace('if(jaIdentificado){',`if(jaIdentificado){
 const human=/^(?:ola |oi )?(?:sou (?:o |a )?(?:responsavel|dono|dona|bruno)|aqui (?:e|quem fala e) (?:o |a )?(?:responsavel|dono|dona|bruno))\\b/.test(norm(pergunta));
 if(human){const reset=await supabase.from('saintsai_sales_conversations').update({ultimo_evento_id:data.ultimo_evento_id.replace(/:autoatendimento$/,''),briefing:{...(data.briefing||{}),__bot_plans_shared:false}}).eq('id',data.id).eq('ultimo_evento_id',data.ultimo_evento_id);if(reset.error)throw reset.error;return {contextoComercial:true};}
 if(data.briefing?.__bot_plans_shared)return {silencio:true};
 if(/\\bplanos?\\b/.test(norm(pergunta))&&/encaminh|responsavel|avaliar|como funcion|pode me contar/.test(norm(pergunta))){
 const claim=await supabase.from('saintsai_sales_conversations').update({briefing:{...(data.briefing||{}),__bot_plans_shared:true},atualizado_em:new Date().toISOString()}).eq('id',data.id).eq('atualizado_em',data.atualizado_em).select('id').maybeSingle();if(claim.error)throw claim.error;if(!claim.data)return {silencio:true};
 const plans=require('./ownerSalesOnboarding.service').available();
 return {resposta:'Pode encaminhar ao responsável: o SaintsAI mantém o atendimento pelo WhatsApp enquanto a equipe está ocupada e, conforme a configuração, responde dúvidas e agenda horários. Planos mensais: '+plans.map(p=>p.nome+' — '+(p.precoMensalCentavos/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})).join('; ')+'. Fico à disposição quando o responsável quiser conversar.',prospectAutomation:true};
 }
 return {silencio:true};
 `).replace("select('id,ultimo_evento_id,lead_status,briefing_step,briefing')","select('id,ultimo_evento_id,lead_status,briefing_step,briefing,atualizado_em')"));
fs.copyFileSync('patches/assets/ownerSalesMediaClean.service.js','src/services/ownerSalesMediaClean.service.js');
edit('src/services/whatsappWorker.service.js',s=>s.replace("require('./pixCopyMessage.service').clean(await atendente.responderMensagemWhatsapp(mensagem))", "require('./ownerSalesMediaClean.service').clean(require('./pixCopyMessage.service').clean(await atendente.responderMensagemWhatsapp(mensagem)))"));
fs.appendFileSync('src/services/ownerSalesPrompt.js',`\nmodule.exports.STYLE+='\\nNunca produza marcadores [IMAGEM: arquivo], [FOTO: arquivo], caminhos de arquivo ou anexos fictícios no texto. Não copie referências de mídia do histórico. O envio de imagens só ocorre por uma ferramenta com mídia real disponível. Ao vender o SaintsAI, mantenha o assunto nas funções e condições do SaintsAI; não interprete uma descrição de exemplo como pedido de compra do produto ilustrado.';\n`);
require('node:child_process').execFileSync(process.execPath,['--test','tests/owner-sales-media-scope.test.cjs'],{stdio:'inherit'});
