'use strict';
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
function explicitStop(v){v=norm(v).replace(/\bnaum\b/g,'nao').replace(/\bkero\b/g,'quero').replace(/\bn (quero|tenho interesse)\b/g,'nao $1');return /\b(?:nao (?:quero|queremos|tenho interesse|temos interesse|estou interessad[oa]|estamos interessad[oa]|me (?:mande|envie|chame))|pare de (?:mandar|enviar|chamar|falar)|para de (?:mandar|enviar|chamar|falar)|remova (?:meu|o meu) (?:numero|contato)|nao obrigad[oa])\b/.test(norm(v));}
function waiting(v){const s=norm(v);if(!s||explicitStop(s))return false;
 return /\b(?:no momento|agora) (?:nao estamos|estamos indisponiveis|estamos fora|nao estou|estou indisponivel)\b/.test(s)&&/\b(?:disponiveis|disponivel|atendendo|atendimento|horario|responder)\b/.test(s)
 || /\b(?:assim que possivel|em breve|logo|dentro de (?:alguns|poucos) minutos)\b.{0,100}\b(?:responderemos|retornaremos|atenderemos|responder|atender|retornar)\b/.test(s)
 || /\b(?:um membro|alguem|um (?:de nossos|dos nossos|da nossa equipe)|nossa equipe|nosso atendente|um atendente)\b.{0,65}\b(?:ira|vai|entrara)\b.{0,25}\b(?:atender|responder|contato)\b/.test(s)
 || /\b(?:aguarde|aguard[ea] um momento)\b.{0,80}\b(?:equipe|atendente|atendimento|responder|retornar)\b/.test(s);
}
module.exports={norm,explicitStop,waiting};
