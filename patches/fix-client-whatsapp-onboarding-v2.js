const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

/* 1) Onboarding: substitui a função inteira por uma versão autocontida. */
{
  const p='src/controllers/clienteHub.controller.js';
  let c=read(p);
  const a=c.indexOf('async function onboardingCliente(req,res){');
  const b=c.indexOf('\nasync function ',a+20);
  if(a<0||b<0)throw new Error('onboardingCliente não encontrado');

  const fn=`async function onboardingCliente(req,res){
  try{
    const loja=await exigirLoja(req,res);if(!loja)return;
    const lojaId=String(loja.id);

    const [
      {data:lojaDados,error:e0},
      {data:servicos,error:e1},
      {data:agendaCfg,error:e2},
      {data:pag,error:e3},
      {data:wa,error:e4},
      {data:profissionais,error:e5}
    ]=await Promise.all([
      supabase.from('lojas').select('id,nome,prompt_mestre').eq('id',lojaId).maybeSingle(),
      supabase.from('saintsai_servicos').select('id').eq('loja_id',lojaId).eq('ativo',true).limit(1),
      supabase.from('saintsai_agenda_config').select('horarios').eq('loja_id',lojaId).maybeSingle(),
      supabase.from('saintsai_pagamento_config').select('provedor,conectado,aceita_pix_online,aceita_pix_presencial,aceita_dinheiro,aceita_cartao_presencial').eq('loja_id',lojaId).maybeSingle(),
      supabase.from('whatsapp_configuracoes').select('id,provedor,numero_whatsapp,identificador_externo,ativo').eq('loja_id',lojaId).eq('ativo',true).limit(10),
      supabase.from('saintsai_profissionais').select('id').eq('loja_id',lojaId).eq('ativo',true).limit(1)
    ]);
    if(e0||e1||e2||e3||e4||e5)throw (e0||e1||e2||e3||e4||e5);
    if(!lojaDados)return res.status(404).json({erro:'Loja não encontrada.'});

    const prompt=String(lojaDados.prompt_mestre||'')
      .replace(/\\[SAINTSAI_CONFIG_CLIENTE\\][\\s\\S]*?\\[\\/SAINTSAI_CONFIG_CLIENTE\\]/g,'')
      .replace(/\\[SAINTSAI_DADOS_NEGOCIO\\][\\s\\S]*?\\[\\/SAINTSAI_DADOS_NEGOCIO\\]/g,'')
      .trim();

    const horarios=agendaCfg?.horarios||{};
    const agendaOk=Object.values(horarios).some(x=>x&&x.aberto===true&&x.inicio&&x.fim);
    const pagOk=Boolean(pag&&(pag.aceita_pix_presencial||pag.aceita_dinheiro||pag.aceita_cartao_presencial||pag.conectado));
    const situacaoPlano=await obterSituacaoPlano(lojaId);
    const planoOk=Boolean(situacaoPlano?.ativo&&!['trial','legado'].includes(String(situacaoPlano?.plano?.codigo||'')));

    let whatsappOk=false;
    const waCfg=(wa||[]).find(x=>x.provedor==='waha')||(wa||[]).find(x=>x.provedor==='meta')||(wa||[])[0]||null;
    if(waCfg){
      if(waCfg.provedor==='waha'){
        try{
          const st=await wahaOnboarding.status(lojaId);
          whatsappOk=Boolean(st.connected&&st.verified&&st.numero&&String(st.numero)===String(waCfg.numero_whatsapp||'').replace(/\\D/g,''));
        }catch(_){whatsappOk=false;}
      }else whatsappOk=true;
    }

    const etapas=[
      {id:'ia',titulo:'Configure a IA',descricao:'Defina o Prompt Mestre e como a IA deve atender.',concluida:prompt.length>0,destino:'ia'},
      {id:'servicos',titulo:'Cadastre seu trabalho',descricao:'Adicione pelo menos um serviço com preço, duração e detalhes.',concluida:Boolean(servicos&&servicos.length),destino:'servicos'},
      {id:'equipe',titulo:'Configure sua equipe',descricao:'Cadastre pelo menos um profissional para atender os serviços.',concluida:Boolean(profissionais&&profissionais.length),destino:'equipe'},
      {id:'agenda',titulo:'Configure a agenda',descricao:'Escolha os dias, horários e intervalos de atendimento.',concluida:agendaOk,destino:'agenda'},
      {id:'pagamentos',titulo:'Configure pagamentos',descricao:'Defina como seus clientes podem pagar pelos atendimentos.',concluida:pagOk,destino:'pagamentos'},
      {id:'pagbank',titulo:'Conecte o PagBank',descricao:'Conecte sua conta PagBank para receber pagamentos online.',concluida:Boolean(pag?.conectado&&pag?.provedor==='pagbank'),destino:'pagamentos'},
      {id:'plano',titulo:'Escolha seu plano SaintsAI',descricao:'Escolha e ative o plano da sua assinatura SaintsAI.',concluida:planoOk,destino:'plano'},
      {id:'operacao',titulo:'Conecte e teste o WhatsApp',descricao:'Ative o WhatsApp e faça um teste antes de divulgar.',concluida:whatsappOk,destino:'operacao'}
    ];
    const concluidas=etapas.filter(x=>x.concluida).length;
    const percentual=Math.round((concluidas/etapas.length)*100);
    const proxima=etapas.find(x=>!x.concluida)||null;
    return res.json({percentual,concluidas,total:etapas.length,etapas,proxima:proxima?.id||null,pronto:percentual===100});
  }catch(e){
    console.error('[cliente-hub] onboarding',e?.message||e);
    return res.status(500).json({erro:'Não foi possível carregar o progresso da configuração.'});
  }
}`;
  c=c.slice(0,a)+fn+c.slice(b);
  write(p,c);
}

/* 2) WAHA: status só é conectado se o próprio WAHA informar a identidade da conta. */
{
  const p='src/services/wahaOnboarding.service.js';
  let s=read(p);
  const a=s.indexOf('async function obterOuCriarConfig(');
  const b=s.indexOf('\nmodule.exports=',a);
  if(a<0||b<0)throw new Error('Tail do wahaOnboarding não encontrado');

  const tail=`function numeroDoMe(data){
  const candidatos=[data?.jid,data?.id,data?.me?.jid,data?.me?.id];
  for(const v of candidatos){
    const raw=String(v||'');
    if(!raw)continue;
    const base=raw.split('@')[0].split(':')[0].replace(/\\D/g,'');
    if(base.length>=10&&base.length<=15)return base;
  }
  return null;
}

async function identidade(sessao,sessionData=null){
  let me=null;
  try{
    const r=await chamar('/api/'+encodeURIComponent(sessao)+'/me',{method:'GET'});
    if(r.ok)me=r.data;
  }catch(_){}
  const numero=numeroDoMe(me)||numeroDoMe(sessionData);
  return {numero,verified:Boolean(numero),me};
}

async function iniciarPareamento(lojaId,phoneNumber){
  const fone=numero(phoneNumber),sessao=sessionName(lojaId),e=env();

  const existente=await chamar('/api/sessions/'+encodeURIComponent(sessao),{method:'GET'});
  const st=String(existente.data?.status||'');
  if(existente.ok&&st==='WORKING'){
    const id=await identidade(sessao,existente.data);
    if(id.verified){
      if(id.numero===fone)return Object.freeze({session:sessao,status:'WORKING',connected:true,verified:true,numero:id.numero,already_connected:true});
      const err=new ErroWaha('Já existe outro número conectado nesta empresa. Desconecte o número atual antes de trocar.',409);
      err.codigo='numero_diferente_conectado';err.numeroAtual=id.numero;throw err;
    }
    throw new ErroWaha('Existe uma sessão ativa, mas não foi possível validar qual número está conectado.',409);
  }

  if(existente.ok&&st==='FAILED'){
    const removido=await chamar('/api/sessions/'+encodeURIComponent(sessao),{method:'DELETE'});
    if(!removido.ok&&removido.status!==404)throw new ErroWaha('Não foi possível resetar a sessão do WhatsApp.',502);
    await new Promise(resolve=>setTimeout(resolve,300));
  }

  const criado=await chamar('/api/sessions',{method:'POST',body:JSON.stringify({
    name:sessao,
    config:{webhooks:[{url:e.publicBase+'/api/webhooks/waha',events:['message'],hmac:{key:e.hmac}}]}
  })});
  if(!criado.ok&&criado.status!==409&&criado.status!==422)throw new ErroWaha('Não foi possível preparar a sessão do WhatsApp.',502);

  const iniciado=await chamar('/api/sessions/'+encodeURIComponent(sessao)+'/start',{method:'POST'});
  if(!iniciado.ok&&iniciado.status!==409)throw new ErroWaha('Não foi possível iniciar a sessão do WhatsApp.',502);

  let codigo=null;
  for(let tentativa=0;tentativa<10;tentativa++){
    codigo=await chamar('/api/'+encodeURIComponent(sessao)+'/auth/request-code',{method:'POST',body:JSON.stringify({phoneNumber:fone})});
    if(codigo.ok&&codigo.data&&ehStringNaoVazia(codigo.data.code))break;
    if(codigo.status!==404&&codigo.status!==409&&codigo.status!==422)break;
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  if(!codigo||!codigo.ok||!codigo.data||!ehStringNaoVazia(codigo.data.code))throw new ErroWaha('Não foi possível gerar o código de pareamento.',codigo&&codigo.status===422?422:502);
  return Object.freeze({session:sessao,code:codigo.data.code,status:'PAIRING',connected:false,verified:false,numero_solicitado:fone});
}

async function status(lojaId){
  const sessao=sessionName(lojaId);
  const r=await chamar('/api/sessions/'+encodeURIComponent(sessao),{method:'GET'});
  if(r.status===404)return Object.freeze({session:sessao,status:'NOT_FOUND',connected:false,verified:false,numero:null});
  if(!r.ok)throw new ErroWaha('Não foi possível consultar a conexão.',502);
  const st=String(r.data?.status||'UNKNOWN');
  if(st!=='WORKING')return Object.freeze({session:sessao,status:st,connected:false,verified:false,numero:null});
  const id=await identidade(sessao,r.data);
  return Object.freeze({session:sessao,status:st,connected:Boolean(id.verified),verified:Boolean(id.verified),numero:id.numero||null});
}

async function desconectar(lojaId){
  const sessao=sessionName(lojaId);
  try{await chamar('/api/sessions/'+encodeURIComponent(sessao)+'/logout',{method:'POST'});}catch(_){}
  const del=await chamar('/api/sessions/'+encodeURIComponent(sessao),{method:'DELETE'});
  if(!del.ok&&del.status!==404)throw new ErroWaha('Não foi possível desconectar o WhatsApp.',502);
  return {ok:true,session:sessao};
}
`;
  s=s.slice(0,a)+tail+s.slice(b);
  s=s.replace(
    "module.exports={iniciarPareamento,status,ErroWaha,sessionName};",
    "module.exports={iniciarPareamento,status,desconectar,ErroWaha,sessionName};"
  );
  write(p,s);
}

/* 3) Portal cliente: usa created_at, sincroniza o número real e oferece troca explícita. */
{
  const p='src/controllers/clienteHub.controller.js';
  let c=read(p);

  const a=c.indexOf('async function statusWhatsappCliente(req,res){');
  const b=c.indexOf('\nasync function parearWhatsappCliente',a);
  if(a<0||b<0)throw new Error('statusWhatsappCliente não encontrado');
  const statusFn=`async function statusWhatsappCliente(req,res){
  try{
    const loja=await exigirLoja(req,res);if(!loja)return;
    const {data,error}=await supabase.from('whatsapp_configuracoes')
      .select('id,provedor,numero_whatsapp,identificador_externo,ativo,created_at')
      .eq('loja_id',loja.id)
      .order('created_at',{ascending:false}).limit(10);
    if(error)throw error;
    const configs=data||[];
    let cfg=configs.find(x=>x.provedor==='waha')||configs.find(x=>x.provedor==='meta')||configs[0]||null;

    if(cfg?.provedor==='waha'||!cfg){
      let st=null;try{st=await wahaOnboarding.status(loja.id);}catch(_){}
      if(st?.connected&&st?.verified&&st?.numero){
        const sessao=wahaOnboarding.sessionName(loja.id);
        if(cfg?.id){
          const {data:upd,error:eu}=await supabase.from('whatsapp_configuracoes')
            .update({numero_whatsapp:st.numero,identificador_externo:sessao,ativo:true,updated_at:new Date().toISOString()})
            .eq('id',cfg.id).eq('loja_id',loja.id).select('id,provedor,numero_whatsapp,identificador_externo,ativo,created_at').single();
          if(eu)throw eu;cfg=upd;
        }else{
          const {data:novo,error:en}=await supabase.from('whatsapp_configuracoes')
            .insert({loja_id:loja.id,provedor:'waha',numero_whatsapp:st.numero,identificador_externo:sessao,ativo:true})
            .select('id,provedor,numero_whatsapp,identificador_externo,ativo,created_at').single();
          if(en)throw en;cfg=novo;
        }
        return res.json({conectado:true,verificado:true,provedor:'waha',numero_whatsapp:st.numero});
      }
      if(cfg?.id&&cfg.ativo){
        await supabase.from('whatsapp_configuracoes').update({ativo:false,updated_at:new Date().toISOString()}).eq('id',cfg.id).eq('loja_id',loja.id);
      }
      return res.json({conectado:false,verificado:false,provedor:cfg?.provedor||'waha',numero_whatsapp:null});
    }

    return res.json({conectado:Boolean(cfg?.ativo),verificado:Boolean(cfg?.ativo),provedor:cfg?.provedor||null,numero_whatsapp:cfg?.numero_whatsapp||null});
  }catch(e){
    console.error('[cliente-hub] whatsapp status',e?.message||e);
    return res.status(500).json({erro:'Não foi possível consultar o WhatsApp.'});
  }
}`;
  c=c.slice(0,a)+statusFn+c.slice(b);

  const pA=c.indexOf('async function parearWhatsappCliente(req,res){');
  const pB=c.indexOf('\nmodule.exports=',pA);
  if(pA<0||pB<0)throw new Error('parearWhatsappCliente não encontrado');
  const funcs=`async function parearWhatsappCliente(req,res){
  try{
    const loja=await exigirLoja(req,res);if(!loja)return;
    const phone=String(req.body?.phone_number||'').replace(/\\D/g,'');
    if(phone.length<10)return res.status(400).json({erro:'Digite um número válido com DDI e DDD.'});

    const x=await wahaOnboarding.iniciarPareamento(loja.id,phone);
    if(x.already_connected&&x.verified){
      await supabase.from('whatsapp_configuracoes').update({
        numero_whatsapp:x.numero,identificador_externo:x.session,ativo:true,updated_at:new Date().toISOString()
      }).eq('loja_id',loja.id).eq('provedor','waha');
      return res.json({already_connected:true,connected:true,verified:true,provedor:'waha',numero_whatsapp:x.numero});
    }

    const {data:cfg}=await supabase.from('whatsapp_configuracoes').select('id').eq('loja_id',loja.id).eq('provedor','waha').order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(cfg?.id){
      await supabase.from('whatsapp_configuracoes').update({
        numero_whatsapp:phone,identificador_externo:x.session,ativo:false,updated_at:new Date().toISOString()
      }).eq('id',cfg.id).eq('loja_id',loja.id);
    }else{
      await supabase.from('whatsapp_configuracoes').insert({
        loja_id:loja.id,provedor:'waha',numero_whatsapp:phone,identificador_externo:x.session,ativo:false
      });
    }
    return res.json(x);
  }catch(e){
    const status=Number(e?.status||500);
    console.error('[cliente-hub] whatsapp pair',e?.message||e);
    return res.status(status).json({erro:e?.message||'Não foi possível iniciar a conexão do WhatsApp.',codigo:e?.codigo||null,numero_atual:e?.numeroAtual||null});
  }
}

async function desconectarWhatsappCliente(req,res){
  try{
    const loja=await exigirLoja(req,res);if(!loja)return;
    await wahaOnboarding.desconectar(loja.id);
    const {error}=await supabase.from('whatsapp_configuracoes')
      .update({ativo:false,updated_at:new Date().toISOString()})
      .eq('loja_id',loja.id).eq('provedor','waha');
    if(error)throw error;
    return res.json({ok:true,conectado:false});
  }catch(e){
    const status=Number(e?.status||500);
    console.error('[cliente-hub] whatsapp disconnect',e?.message||e);
    return res.status(status).json({erro:e?.message||'Não foi possível desconectar o WhatsApp.'});
  }
}`;
  c=c.slice(0,pA)+funcs+c.slice(pB);

  c=c.replace(/module\.exports=\{([^}]*)\}/,(m,inside)=>{
    let x=inside;
    if(!x.includes('desconectarWhatsappCliente'))x=x.trim().replace(/,$/,'')+',desconectarWhatsappCliente';
    return 'module.exports={'+x+'}';
  });
  write(p,c);
}

/* 4) Rota de desconexão. */
{
  const p='src/routes/clienteHub.routes.js';
  let r=read(p);
  if(!r.includes("'/whatsapp/disconnect'")){
    const anchor="r.post('/whatsapp/pair',c.parearWhatsappCliente);";
    if(!r.includes(anchor))throw new Error('Rota pair não encontrada');
    r=r.replace(anchor,anchor+"\nr.post('/whatsapp/disconnect',c.desconectarWhatsappCliente);");
  }
  write(p,r);
}

/* 5) UI: mostra somente número validado e botão explícito para trocar. */
{
  const p='public/cliente-whatsapp.html';
  let h=read(p);
  h=h.replace(
    '<div class="muted">Este número já está conectado ao SaintsAI. Não é necessário gerar outro código.</div>',
    '<div class="muted">Este número foi confirmado diretamente pela sessão do WhatsApp.</div><div class="btns"><button class="btn secondary" id="disconnect">Trocar número</button></div>'
  );
  h=h.replace(
    "const ok=!!x.conectado;$('dot').classList.toggle('ok',ok);$('status').textContent=ok?'WhatsApp conectado':'WhatsApp não conectado';",
    "const ok=!!x.conectado&&x.verificado!==false;$('dot').classList.toggle('ok',ok);$('status').textContent=ok?'WhatsApp conectado e verificado':'WhatsApp não conectado';"
  );
  h=h.replace(
    "if(x&&x.already_connected){setStatus({conectado:true,provedor:x.provedor||'waha',numero_whatsapp:x.numero_whatsapp||phone});return;}",
    "if(x&&x.already_connected&&x.verified){setStatus({conectado:true,verificado:true,provedor:x.provedor||'waha',numero_whatsapp:x.numero_whatsapp});return;}"
  );
  if(!h.includes("$('disconnect').onclick")){
    h=h.replace(
      "$('refresh').onclick=()=>carregarStatus();",
      "$('refresh').onclick=()=>carregarStatus();\n$('disconnect').onclick=async()=>{if(!confirm('Desconectar o número atual para conectar outro?'))return;const b=$('disconnect');try{b.disabled=true;await apiFetch('/lojas/'+loja.id+'/cliente-hub/whatsapp/disconnect',{method:'POST',body:'{}'});setStatus({conectado:false,verificado:false,provedor:'waha',numero_whatsapp:null});$('msg').textContent='Número desconectado. Agora digite o novo número.';}catch(e){$('msg').textContent=e.message||'Não foi possível desconectar.';}finally{b.disabled=false;}};"
    );
  }
  write(p,h);
}

for(const p of [
  'src/services/wahaOnboarding.service.js',
  'src/controllers/clienteHub.controller.js',
  'src/routes/clienteHub.routes.js'
])cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});

console.log('[client-wa-onboarding-v2] PASS onboarding autocontido e WhatsApp validado pela identidade WAHA');
