// Only the owner's sales agent uses this policy; tenant customer service is unchanged.
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
function foraDoEscopo(v){
 const s=norm(v);
 if(/\b(?:ignore|ignora|esqueca|desconsidere)\b.{0,45}\b(?:instruc|regras|prompt|sistema)\w*|\b(?:revele|mostre|envie|qual)\b.{0,40}\b(?:chave api|api key|token|senha do sistema|prompt interno|prompt de sistema)\b/.test(s))return true;
 // Explicit unrelated requests remain silent even if they contain "cliente", "foto", "sou" or "pix".
 if(/\b(?:previsao do tempo|vai chover|quem ganhou o jogo|resultado do jogo|futebol|presidente|eleicoes|lula|bolsonaro|horoscopo|signo|receita de bolo|capital da|conte uma piada|me conta uma piada|resolver equacao|resolva|raiz quadrada|quanto e \d|diagnostico medico|dor de cabeca|bitcoin|inflacao|traduz|traduza)\b/.test(s)&&!/\b(?:atendimento|saintsai|whatsapp|agente|sistema)\b/.test(s))return true;
 return /\b(?:manda|mande|envie|mostre|quero)\b.{0,25}\b(?:foto|video|audio)\b.{0,30}\b(?:cachorro|gato|celebridade|porn|nudes|piada|musica)\b/.test(s);
}
function respostaBriefingValida(v,lead){
 if(lead?.lead_status!=='briefing'||foraDoEscopo(v))return false;
 const raw=String(v||'').trim(),s=norm(v),step=Number(lead.briefing_step||0),fields=require('./businessProfiles.service').fields(['nome_empresa','ramo','produtos_servicos','horario','pagamentos','entrega','tom','regras'].map(chave=>({chave})),lead.briefing||{}),field=fields[step]?.chave;
 if(raw.length<2||raw.length>3000||/\?|^(?:como|qual|quais|quanto|onde|por que)\b/.test(s))return false;
 if(field==='nome_empresa')return raw.length<=100&&/^[\p{L}\p{N} .&'\-]+$/u.test(raw);
 if(['ramo','produtos_servicos','profissionais'].includes(field))return s.length>=3;
 if(field==='horario')return /\d|segunda|terca|quarta|quinta|sexta|sabado|domingo|todos os dias|horario|24 horas|flexivel/.test(s);
 if(field==='pagamentos')return /pix|cartao|dinheiro|boleto|credito|debito|transferencia|especie|nao sei|a definir/.test(s);
 if(field==='entrega')return /entrega|retirada|presencial|domicilio|local|remoto|online|delivery|nao/.test(s);
 if(field==='tom')return /profissional|amigavel|direto|casual|formal|informal|simpatico|educado|natural|humanizado/.test(s);
 return field==='regras';
}
module.exports={norm,foraDoEscopo,respostaBriefingValida};
