const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

fs.mkdirSync('src/services',{recursive:true});

write('src/services/clientPush.service.js',`
const admin=require('firebase-admin');
const supabase=require('../config/supabase');

function firebaseApp(){
  if(admin.apps.length)return admin.app();
  const raw=String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'').trim();
  if(!raw)throw new Error('firebase_nao_configurado');
  const cfg=JSON.parse(raw);
  return admin.initializeApp({credential:admin.credential.cert(cfg)});
}

async function registrar({lojaId,userId,token}){
  const fcm=String(token||'').trim();
  if(fcm.length<20)throw new Error('token_invalido');
  const {error}=await supabase.from('saintsai_push_devices').upsert({
    loja_id:lojaId,user_id:userId,fcm_token:fcm,plataforma:'android',ativo:true,atualizado_em:new Date().toISOString()
  },{onConflict:'fcm_token'});
  if(error)throw error;
}

async function notificarLoja(lojaId,{title='SaintsAI',body='',tipo='geral',agendamentoId='',valor='' }={}){
  const {data:devices,error}=await supabase.from('saintsai_push_devices')
    .select('id,fcm_token').eq('loja_id',lojaId).eq('ativo',true);
  if(error)throw error;
  if(!devices?.length)return {enviados:0};
  const messaging=firebaseApp().messaging();
  let enviados=0;
  for(const d of devices){
    try{
      await messaging.send({
        token:d.fcm_token,
        data:{
          title:String(title),body:String(body),tipo:String(tipo),
          agendamento_id:String(agendamentoId||''),valor:String(valor||'')
        },
        android:{priority:'high',notification:{channelId:'saintsai_client_updates'}}
      });
      enviados++;
    }catch(e){
      const code=String(e?.code||'');
      console.error('[client-push]',code||e?.message||e);
      if(code.includes('registration-token-not-registered')||code.includes('invalid-registration-token')){
        await supabase.from('saintsai_push_devices').update({ativo:false,atualizado_em:new Date().toISOString()}).eq('id',d.id);
      }
    }
  }
  return {enviados};
}
module.exports={registrar,notificarLoja};
`);

let c=read('src/controllers/clienteHub.controller.js');
if(!c.includes("const clientPush = require('../services/clientPush.service');")){
  c=c.replace("const supabase = require('../config/supabase');","const supabase = require('../config/supabase');\nconst clientPush = require('../services/clientPush.service');");
}
if(!c.includes('async function registrarPush(')){
  const anchor='async function resumo(req,res){';
  const fn=`
async function registrarPush(req,res){
  try{
    const loja=await exigirLoja(req,res);if(!loja)return;
    await clientPush.registrar({lojaId:loja.id,userId:req.usuario.id,token:req.body?.fcm_token});
    return res.json({ok:true});
  }catch(e){
    console.error('[cliente-push-register]',e?.message||e);
    return res.status(500).json({erro:'Não foi possível ativar as notificações.'});
  }
}

`;
  c=c.replace(anchor,fn+anchor);
}
c=c.replace(
  /module\.exports=\{([^}]*)\};/,
  (m,inside)=>inside.includes('registrarPush')?m:`module.exports={registrarPush,${inside}};`
);
write('src/controllers/clienteHub.controller.js',c);

let r=read('src/routes/clienteHub.routes.js');
if(!r.includes("r.post('/push-device'")){
  r=r.replace("r.get('/',c.resumo);","r.get('/',c.resumo);\nr.post('/push-device',c.registrarPush);");
}
write('src/routes/clienteHub.routes.js',r);

let b=read('src/services/bookingPublic.service.js');
if(!b.includes("const clientPush=require('./clientPush.service');")){
  b=b.replace("const pagBankPix=require('./pagBankPix.service');","const pagBankPix=require('./pagBankPix.service');\nconst clientPush=require('./clientPush.service');");
}
if(!b.includes("clientPush.notificarLoja(link.loja_id")){
  const anchor="  await supabase.from('saintsai_agenda_links').update({usado_em:new Date().toISOString(),cliente_nome:nome}).eq('id',link.id);";
  const notify=`
  clientPush.notificarLoja(link.loja_id,{
    title:'Novo agendamento 📅',
    body:nome+' · '+servico.nome+' · R$ '+dinheiro(precoAtual).replace('.',','),
    tipo:'novo_agendamento',agendamentoId:ag.id,valor:precoAtual
  }).catch(e=>console.error('[booking-push]',e?.message||e));
`;
  if(!b.includes(anchor))throw new Error('Anchor booking não encontrado');
  b=b.replace(anchor,anchor+'\n'+notify);
}
write('src/services/bookingPublic.service.js',b);

let p=read('src/services/pagBankPix.service.js');
if(!p.includes("const clientPush=require('./clientPush.service');")){
  const anchor="const supabase=require('../config/supabase');";
  if(p.includes(anchor))p=p.replace(anchor,anchor+"\nconst clientPush=require('./clientPush.service');");
}
const paid="if(ps==='PAID'&&data){try{await enviarConfirmacaoPagamento(data);}catch(e){console.error('[pagbank-confirmacao]',e?.message||e);}}return data;";
if(p.includes(paid)&&!p.includes("tipo:'pagamento_confirmado'")){
  p=p.replace(paid,"if(ps==='PAID'&&data){try{await enviarConfirmacaoPagamento(data);}catch(e){console.error('[pagbank-confirmacao]',e?.message||e);}clientPush.notificarLoja(data.loja_id,{title:'Pagamento confirmado ✅',body:(data.cliente_nome||'Cliente')+' · R$ '+Number(data.valor||0).toFixed(2).replace('.',','),tipo:'pagamento_confirmado',agendamentoId:data.id,valor:data.valor}).catch(e=>console.error('[pagbank-push]',e?.message||e));}return data;");
}
write('src/services/pagBankPix.service.js',p);

let h=read('public/cliente-central.html');
if(!h.includes('SAINTSAI_NATIVE_CLIENT_V1')){
  h=h.replace('</style>',`
/* SAINTSAI_NATIVE_CLIENT_V1 */
.native-update{border:1px solid rgba(168,92,255,.28);background:rgba(113,54,180,.12);color:#dcc8ff;border-radius:12px;padding:10px 12px;font-weight:800}
.native-version{font-size:10px;color:#8f849b;margin-top:4px}
</style>`);
  const sair='<button class="btn2" onclick="fazerLogout()">Sair</button>';
  if(h.includes(sair))h=h.replace(sair,'<div style="display:flex;gap:8px;align-items:center"><button id="native-update" class="native-update" type="button" style="display:none">Atualizar app</button>'+sair+'</div>');
  h=h.replace('async function carregar(){',`
async function ativarRecursosNativos(){
  try{
    if(!window.AndroidClient)return;
    const up=document.getElementById('native-update');
    if(up&&typeof window.AndroidClient.installLatest==='function'){
      up.style.display='';
      const versao=window.AndroidClient.getVersionName?.()||'';
      up.title=versao?'Versão instalada: '+versao:'Atualizar aplicativo';
      up.onclick=()=>window.AndroidClient.installLatest();
    }
    const token=String(window.AndroidClient.getPushToken?.()||'').trim();
    if(token.length>20&&loja){
      await apiFetch('/lojas/'+loja.id+'/cliente-hub/push-device',{method:'POST',body:JSON.stringify({fcm_token:token})});
    }
  }catch(e){console.warn('[native-client]',e)}
}
async function carregar(){`);
  h=h.replace('renderServicos();renderAgenda();renderPag();','renderServicos();renderAgenda();renderPag();setTimeout(ativarRecursosNativos,700);');
  h=h.replace('</body>','<!-- SAINTSAI_NATIVE_CLIENT_V1 -->\n</body>');
}
write('public/cliente-central.html',h);

for(const file of ['src/services/clientPush.service.js','src/controllers/clienteHub.controller.js','src/routes/clienteHub.routes.js','src/services/bookingPublic.service.js','src/services/pagBankPix.service.js']){
  cp.execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
}
console.log('Push e atualização nativa do SaintsAI Cliente aplicados.');
