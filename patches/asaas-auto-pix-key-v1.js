const fs=require('node:fs');
const cp=require('node:child_process');
const p='src/services/asaas.service.js';
let s=fs.readFileSync(p,'utf8');

const old=`async function obterChavePixAtiva() {
  const lista = await chamarAsaas('/v3/pix/addressKeys?status=ACTIVE&limit=20', { method:'GET' });
  const itens = Array.isArray(lista?.data) ? lista.data : [];
  const ativa = itens.find((item) => String(item?.status || '').toUpperCase() === 'ACTIVE' && item?.key);
  return ativa?.key ? String(ativa.key) : null;
}`;

const neu=`async function obterChavePixAtiva() {
  const listar=async()=>{
    const lista = await chamarAsaas('/v3/pix/addressKeys?status=ACTIVE&limit=20', { method:'GET' });
    const itens = Array.isArray(lista?.data) ? lista.data : [];
    const ativa = itens.find((item) => String(item?.status || '').toUpperCase() === 'ACTIVE' && item?.key);
    return ativa?.key ? String(ativa.key) : null;
  };
  let chave=await listar();
  if(chave)return chave;
  try{
    const criada=await chamarAsaas('/v3/pix/addressKeys',{method:'POST',body:JSON.stringify({type:'EVP'})});
    if(criada?.key && String(criada?.status||'').toUpperCase()==='ACTIVE')return String(criada.key);
  }catch(e){
    if(e?.message!=='asaas_api_erro')throw e;
    console.warn('[asaas] não foi possível criar chave Pix automática',{status:e?.status||null});
  }
  for(let i=0;i<3;i++){
    await new Promise(r=>setTimeout(r,700));
    chave=await listar();
    if(chave)return chave;
  }
  return null;
}`;

if(!s.includes(old))throw new Error('obterChavePixAtiva original não encontrado');
s=s.replace(old,neu);
fs.writeFileSync(p,s);
cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
if(!s.includes("/v3/pix/addressKeys',{method:'POST'"))throw new Error('Criação automática de chave não aplicada');
console.log('[asaas-pix-key] PASS cria EVP automaticamente quando necessário');