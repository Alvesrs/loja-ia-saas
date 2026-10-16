'use strict';
const {clean}=require('./pixCopyMessage.service');
function payload(text){const r=clean({resposta:text});return r.resposta!==undefined && /^000201/.test(r.resposta) && clean({resposta:'Pix\n'+r.resposta}).resposta===r.resposta ? r.resposta:null;}
function message(text){const code=payload(text);if(!code)return text;const base=process.env.SAINTSAI_PUBLIC_BASE_URL||process.env.PUBLIC_BASE_URL;try{const url=new URL(base);if(url.protocol!=='https:')return code;return code+'\n\nCopiar Pix com um toque:\n'+url.origin+'/painel/pix/copiar/#'+encodeURIComponent(code);}catch{return code;}}
module.exports={payload,message};
