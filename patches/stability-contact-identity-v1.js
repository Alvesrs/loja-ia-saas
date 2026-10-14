'use strict';const fs=require('node:fs');
for(const p of ['src/services/ownerProspecting.service.js','patches/assets/owner-prospecting.service.js']){
 let s=fs.readFileSync(p,'utf8');if(s.includes('reverseAuthorizedLid'))continue;
 const anchor="if(authorized.length===1)return Object.freeze({...evento,contato:authorized[0].contato});return pn!==atual?Object.freeze({...evento,contato:pn}):evento;";
 const replacement="if(authorized.length===1)return Object.freeze({...evento,contato:authorized[0].contato});if(!authorized.length&&atual.endsWith('@c.us')&&/^55\\d{10,11}@c\\.us$/.test(atual)){let chat;try{chat=await chatPorTelefone(evento.destinatarioId,atual.split('@')[0]);}catch(e){if(e.status!==400)throw e;}if(chat?.endsWith('@lid')){const reverseAuthorizedLid=await db.from('saintsai_sales_conversations').select('contato,ultimo_evento_id').eq('loja_id',l.id).eq('session_id',evento.destinatarioId).eq('contato',chat).maybeSingle();if(reverseAuthorizedLid.error)throw reverseAuthorizedLid.error;if(reverseAuthorizedLid.data&&marker(reverseAuthorizedLid.data.ultimo_evento_id))return Object.freeze({...evento,contato:chat});}}return pn!==atual?Object.freeze({...evento,contato:pn}):evento;";
 if(!s.includes(anchor))throw Error('Contact identity anchor missing');fs.writeFileSync(p,s.replace(anchor,replacement));
}
