const fs=require('node:fs');
const p='src/services/wahaOnboarding.service.js';let s=fs.readFileSync(p,'utf8');
const anchor='  let codigo=null;\n  for(let tentativa=0;tentativa<10;tentativa++){';
if(!s.includes(anchor))throw Error('Pareamento WAHA: início da espera não encontrado');
s=s.replace(anchor,`  // Starting a NOWEB session returns before its socket is ready.
  // Wait for the pairing state instead of immediately calling request-code.
  for(let espera=0;espera<12;espera++){
    const pronta=await chamar('/api/sessions/'+encodeURIComponent(sessao),{method:'GET'});
    if(!pronta.ok&&pronta.status!==404)throw new ErroWaha('Não foi possível verificar a inicialização do WhatsApp.',502);
    const estado=String(pronta.data?.status||'');
    if(estado==='FAILED')throw new ErroWaha('A sessão do WhatsApp falhou ao iniciar. Tente reconectar novamente.',503);
    if(estado!=='STARTING'&&estado!=='STOPPED')break;
    if(espera===11)throw new ErroWaha('O WhatsApp ainda está iniciando. Aguarde alguns segundos e tente novamente.',503);
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  let codigo=null;
  for(let tentativa=0;tentativa<10;tentativa++){`);
const retry='    if(codigo.status!==404&&codigo.status!==409&&codigo.status!==422)break;';
const retrySpace='    if(codigo.status!==404 && codigo.status!==409 && codigo.status!==422) break;';
const replacement=`    const falhaInicializacao=codigo.status===500&&/waitForConnectionUpdate|socket.*(?:undefined|not.*ready)|session.*(?:not.*ready|starting)/i.test(JSON.stringify(codigo.data||{}));
    if(![404,409,422].includes(codigo.status)&&!falhaInicializacao)break;`;
if(s.includes(retry))s=s.replace(retry,replacement);else if(s.includes(retrySpace))s=s.replace(retrySpace,replacement);else throw Error('Pareamento WAHA: política de tentativa não encontrada');
fs.writeFileSync(p,s);console.log('Reconexão WAHA aguarda a sessão e recupera somente falhas conhecidas de inicialização.');
