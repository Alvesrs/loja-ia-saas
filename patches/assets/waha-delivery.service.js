const fail=()=>Object.assign(Error('O WhatsApp recusou a entrega da abordagem. Confira no WhatsApp se sua conta está restrita. A mensagem não será reenviada automaticamente.'),{status:409,deliveryRejected:true});
function marker(value){const m=String(value||'').match(/:delivery:([A-Za-z0-9_-]+):ack:(pending|delivered|failed)/);return m?{id:Buffer.from(m[1],'base64url').toString('utf8'),estado:m[2]}:null;}
function encode(id,state){return ':delivery:'+Buffer.from(id||'unknown').toString('base64url')+':ack:'+state;}
async function check(session,id,{attempts=3}={}){
 if(typeof id!=='string'||!id||id==='unknown'||id.length>250)return 'pending';
 const base=String(process.env.WAHA_BASE_URL||'').replace(/\/+$/,'');if(!base||!process.env.WAHA_API_KEY)return 'pending';
 for(let n=0;n<attempts;n++){
  try{const r=await fetch(base+'/api/'+encodeURIComponent(session)+'/chats/all/messages/'+encodeURIComponent(id)+'?downloadMedia=false',{headers:{'X-Api-Key':process.env.WAHA_API_KEY},signal:AbortSignal.timeout(2500)});if(r.ok){const m=await r.json();if(m.ack===-1||m.ackName==='ERROR')return 'failed';if([2,3,4].includes(m.ack)||['DEVICE','READ','PLAYED'].includes(m.ackName))return 'delivered';}else if([401,403,404,422].includes(r.status))return 'pending';}catch{return 'pending';}
  if(n+1<attempts)await new Promise(resolve=>setTimeout(resolve,500));
 }
 return 'pending';
}
module.exports={check,marker,encode,fail};
