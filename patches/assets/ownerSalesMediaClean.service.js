'use strict';
function clean(r){if(typeof r?.resposta!=='string'||r.midias?.length||r.imagemUrl||r.videoUrl)return r;const text=r.resposta.replace(/\[(?:IMAGEM|FOTO|VIDEO|VÍDEO|ANEXO)\s*:[^\]]*\]/gi,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').trim();return {...r,resposta:text||'Posso explicar como o atendimento e o agendamento funcionam no SaintsAI.'};}
module.exports={clean};
