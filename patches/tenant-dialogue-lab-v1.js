'use strict';const fs=require('node:fs');
function edit(file,a,b){const s=fs.readFileSync(file,'utf8');if(s.includes(b))return;if(!s.includes(a))throw Error('Tenant dialogue anchor missing: '+file);fs.writeFileSync(file,s.replace(a,b));}
fs.copyFileSync('patches/assets/tenantDialogue.service.js','src/services/tenantDialogue.service.js');
edit('src/services/ia.service.js','    return resposta;','    return require(\'./tenantDialogue.service\').safe(resposta);');
edit('src/services/ia.service.js',"  console.log('[ia.service] resposta_origem=fallback');", "  console.log('[ia.service] resposta_origem=fallback');\n  const conversational=require('./tenantDialogue.service').fallback(pergunta,historico);if(conversational)return conversational;");
edit('src/services/iaPrompt.service.js','- Seja educado, objetivo e natural.',`- Seja educado, objetivo e natural.
- Converse com clareza, sem formalidade excessiva nem frases automáticas repetidas; preserve a personalidade cadastrada pelo negócio.
- Entenda abreviações e erros de digitação pelo contexto sem corrigir a escrita do cliente. Não altere nomes, números, datas, preços ou códigos; confirme quando houver mais de uma interpretação.
- Considere a última mensagem e o histórico antes de perguntar. Respostas como "sim", "esse", "o segundo" e "??" dependem da conversa anterior; não reinicie o atendimento nem repita perguntas já respondidas.
- Faça no máximo uma pergunta necessária de cada vez. Nunca interprete uma mensagem ambígua como autorização para cobrar, agendar, cancelar ou alterar dados.
- A conversa textual não executa ações: só confirme pagamento, reserva, cancelamento ou envio de mídia quando existir resultado confirmado da ferramenta correspondente. "Paguei" sozinho não comprova pagamento.
- Não envie raciocínio interno, JSON de ferramentas, marcadores [SILENCIO] ou anexos fictícios ao cliente.`);
edit('src/services/iaPrompt.service.js','    contexto,\n    pergunta,',"    contexto: require('./tenantDialogue.service').hint(pergunta)?[contexto,require('./tenantDialogue.service').hint(pergunta)].filter(Boolean).join('\n\n'):contexto,\n    pergunta,");
edit('src/services/whatsappAtendente.service.js',"    } catch (_) {\n      historico = [];\n    }", "    } catch (_) {\n      if(!vendaAtiva)throw new Error('historico_contexto_indisponivel');\n      historico = [];\n    }");
edit('src/services/whatsappAtendente.service.js','resposta, ...(dialogueContext.generated?', 'resposta, ...(!vendaAtiva?{tenantDialogue:true}:{}), ...(dialogueContext.generated?');
edit('src/services/whatsappWorker.service.js','if(resposta.salesDialogue&&!resposta.interativo', 'if((resposta.salesDialogue||resposta.tenantDialogue)&&!resposta.interativo');
for(const file of ['public/cliente-versao.json','public/admin-versao.json']){const v=JSON.parse(fs.readFileSync(file,'utf8'));if(v.versao!=='2026.10.15.16'){v.versao='2026.10.15.16';v.novidades.unshift('Atendimento dos clientes: contexto preservado em falhas, proteção de mensagens seguidas e respostas naturais');fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n');}}
