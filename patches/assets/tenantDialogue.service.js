'use strict';
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
function safe(value){
 if(typeof value!=='string')return null;
 const text=value.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi,'').trim();
 if(!text||/<\/?think\b/i.test(text)||/^\[[A-Z_ -]{3,40}\]$/i.test(text)||/\[(?:IMAGEM|FOTO|VIDEO|AUDIO)\s*:[^\]]*\]/i.test(text))return null;
 if(/^\s*\{[\s\S]*"(?:tool_calls|system_prompt|choices)"\s*:/.test(text))return null;
 return text;
}
function fallback(question,history=[]){const t=norm(question);
 if(/^(?:oi+|ola+|bom dia|boa tarde|boa noite)(?: tudo bem)?$/.test(t))return 'Oi! Como posso te ajudar?';
 if(/^(?:obrigad[oa]+|obg|vlw|valeu|muito obrigad[oa])$/.test(t))return 'Por nada! Se precisar de algo, é só me chamar.';
 if(/^[?？\s]+$/.test(String(question||''))||/^(?:nao entendi|n entendi|como assim|pode explicar melhor)$/.test(t))return Array.isArray(history)&&history.some(m=>m?.role==='assistant')?'Me diz qual parte da minha última mensagem ficou confusa para eu explicar melhor.':'Me conta um pouco mais sobre o que você precisa para eu te ajudar.';
 return null;
}
function hint(question){const original=String(question||'');const words={vc:'você',vcs:'vocês',qto:'quanto',qnt:'quanto',oq:'o que',pq:'por que',tbm:'também',wpp:'WhatsApp',agendamnto:'agendamento',agendamentto:'agendamento',atendimemto:'atendimento',funcina:'funciona'};const interpreted=original.replace(/\b[a-z]+\b/gi,v=>words[v.toLowerCase()]||v);return interpreted===original?'':'Leitura provável das abreviações e erros (confira com o histórico; preserve nomes, valores, datas e identificadores): '+interpreted;}
module.exports={safe,fallback,hint};
