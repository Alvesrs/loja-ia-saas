const BASE='https://resembleai-chatterbox-multilingual-tts-pt-br.hf.space';
function falaCurta(input){
 const s=String(input||'').replace(/https?:\/\/\S+/g,'').replace(/[*_#`]/g,'').replace(/\s+/g,' ').trim();
 if(!s)throw Error('voz_texto_vazio');
 if(s.length<=300)return s;
 const head=s.slice(0,297),end=Math.max(head.lastIndexOf('. '),head.lastIndexOf('? '),head.lastIndexOf('! '));
 return end>=60?head.slice(0,end+1):head.slice(0,head.lastIndexOf(' '))+'.';
}
function decodeEvent(stream){
 const blocks=stream.split(/\r?\n\r?\n/);
 for(const block of blocks){
  const type=block.match(/^event: (.+)$/m)?.[1]?.trim();
  const data=block.split(/\r?\n/).filter(l=>l.startsWith('data: ')).map(l=>l.slice(6)).join('\n');
  if(type==='error')throw Error('chatterbox_fila_indisponivel');
  if(type==='complete'){const result=JSON.parse(data);return result?.[0];}
 }
 throw Error('chatterbox_audio_nao_concluido');
}
async function gerar(input){
 const base=String(process.env.SAINTSAI_CHATTERBOX_URL||BASE).replace(/\/+$/,'');
 const origin=new URL(base).origin,signal=AbortSignal.timeout(90000);
 async function request(url,options={}){const response=await fetch(url,{...options,signal});if(!response.ok)throw Error('chatterbox_http_'+response.status);return response;}
 const config=await (await request(base+'/config')).json();
 const ref=config.components?.find(c=>c.type==='audio'&&c.props?.label==='Reference Audio File (Optional)')?.props?.value;
 if(!ref?.path)throw Error('chatterbox_referencia_indisponivel');
 const started=await (await request(base+'/gradio_api/call/generate_tts_audio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:[falaCurta(input),ref,0.5,0.8,42,0.5]})})).json();
 if(!/^[a-zA-Z0-9_-]+$/.test(started.event_id||''))throw Error('chatterbox_evento_invalido');
 const result=decodeEvent(await (await request(base+'/gradio_api/call/generate_tts_audio/'+started.event_id)).text());
 const url=new URL(result?.url||'');if(url.origin!==origin)throw Error('chatterbox_audio_origem_invalida');
 const response=await request(url.href),declared=Number(response.headers.get('content-length')||0);if(declared>12000000)throw Error('chatterbox_audio_grande');
 const buffer=Buffer.from(await response.arrayBuffer());
 if(buffer.length<44||buffer.length>12000000||buffer.toString('ascii',0,4)!=='RIFF'||buffer.toString('ascii',8,12)!=='WAVE')throw Error('chatterbox_audio_invalido');
 return buffer;
}
module.exports={gerar,falaCurta,decodeEvent};
