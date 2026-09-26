const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

write('src/services/agendaLembretes.service.js', `
const supabase=require('../config/supabase');
const envio=require('./whatsappEnvio.service');
const assinaturas=require('./assinaturas.service');

function formatar(inicio){
  const d=new Date(inicio);
  return {
    data:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(d),
    hora:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)
  };
}

async function reivindicar(ag,tipo){
  const {data,error}=await supabase.from('saintsai_agenda_lembretes').insert({
    agendamento_id:ag.id,loja_id:ag.loja_id,tipo,status:'processando',tentativas:1,atualizado_em:new Date().toISOString()
  }).select('id').maybeSingle();
  if(!error&&data)return data;
  if(error&&error.code==='23505')return null;
  if(error)throw error;
  return null;
}

async function finalizar(id,status,codigo=null){
  const payload={status,atualizado_em:new Date().toISOString(),erro_codigo:codigo};
  if(status==='enviado')payload.enviado_em=new Date().toISOString();
  await supabase.from('saintsai_agenda_lembretes').update(payload).eq('id',id);
}

async function configWhatsApp(lojaId){
  const {data,error}=await supabase.from('whatsapp_configuracoes')
    .select('id,loja_id,provedor,identificador_externo,ativo')
    .eq('loja_id',lojaId).eq('ativo',true).limit(10);
  if(error)throw error;
  const arr=data||[];
  return arr.find(x=>x.provedor==='waha')||arr.find(x=>x.provedor==='meta')||arr[0]||null;
}

async function enviar(ag,tipo){
  const claim=await reivindicar(ag,tipo);if(!claim)return false;
  try{
    const cfg=await configWhatsApp(ag.loja_id);
    if(!cfg||!ag.cliente_whatsapp)throw new Error('sem_whatsapp');
    const f=formatar(ag.inicio), servico=ag.saintsai_servicos?.nome||'seu atendimento';
    const texto=tipo==='24h'
      ? 'Lembrete: '+servico+' está marcado para '+f.data+' às '+f.hora+'. Responda CONFIRMAR para confirmar sua presença ou CANCELAR para desmarcar.'
      : 'Lembrete: faltam cerca de 2 horas para '+servico+', marcado para '+f.hora+'. Se precisar desmarcar, responda CANCELAR.';
    const idExterno='agenda-'+tipo+'-'+ag.id;
    const mensagem=Object.freeze({canal:'whatsapp',lojaId:ag.loja_id,configuracaoId:cfg.id,contato:ag.cliente_whatsapp,texto:'',idExterno,timestamp:new Date().toISOString()});
    const resposta=Object.freeze({lojaId:ag.loja_id,contato:ag.cliente_whatsapp,idExterno,resposta:texto});
    const contexto=Object.freeze({provedor:cfg.provedor,destinatarioId:cfg.identificador_externo});
    await envio.enviarRespostaWhatsapp(mensagem,resposta,contexto);
    await finalizar(claim.id,'enviado');
    return true;
  }catch(e){
    await finalizar(claim.id,'falhou',String(e&&e.message||'falha').slice(0,80));
    return false;
  }
}

async function processarLembretes(){
  const agora=new Date(), limite=new Date(agora.getTime()+24*60*60*1000);
  const {data:ags,error}=await supabase.from('saintsai_agendamentos')
    .select('id,loja_id,cliente_nome,cliente_whatsapp,inicio,status,confirmado_cliente_em,saintsai_servicos(nome)')
    .eq('status','confirmado').not('cliente_whatsapp','is',null)
    .gt('inicio',agora.toISOString()).lte('inicio',limite.toISOString())
    .order('inicio',{ascending:true}).limit(100);
  if(error)throw error;if(!(ags||[]).length)return {processados:0,enviados:0};

  const lojas=[...new Set(ags.map(a=>a.loja_id))];
  const {data:cfgs,error:ec}=await supabase.from('saintsai_agenda_config')
    .select('loja_id,lembrete_24h,lembrete_2h').in('loja_id',lojas);
  if(ec)throw ec;
  const mapaCfg=new Map((cfgs||[]).map(c=>[c.loja_id,c]));
  const planos=new Map();let enviados=0,processados=0;

  for(const ag of ags){
    const cfg=mapaCfg.get(ag.loja_id)||{lembrete_24h:true,lembrete_2h:true};
    const horas=(new Date(ag.inicio).getTime()-Date.now())/3600000;
    let tipo=null;
    if(cfg.lembrete_2h!==false&&horas<=2&&horas>0)tipo='2h';
    else if(cfg.lembrete_24h!==false&&horas<=24&&horas>2.25)tipo='24h';
    if(!tipo)continue;
    if(!planos.has(ag.loja_id)){
      try{planos.set(ag.loja_id,await assinaturas.obterSituacaoPlano(ag.loja_id));}
      catch(_){planos.set(ag.loja_id,{ativo:false});}
    }
    if(!planos.get(ag.loja_id)?.ativo)continue;
    processados+=1;
    if(await enviar(ag,tipo))enviados+=1;
  }
  return {processados,enviados};
}
module.exports={processarLembretes};
`);

let worker=read('src/services/whatsappWorker.service.js');
if(!worker.includes("agendaLembretes")){
  worker=worker.replace("const salesVoice = require('./salesVoice.service');","const salesVoice = require('./salesVoice.service');\nconst agendaLembretes = require('./agendaLembretes.service');");
  worker=worker.replace("let cicloEmAndamento = false;","let cicloEmAndamento = false;\nlet ultimaChecagemLembretes = 0;");
  const old="async function executarCiclo({ maxJobs = 10 } = {}) {\n  if (cicloEmAndamento) return 0;\n  cicloEmAndamento = true;";
  if(!worker.includes(old))throw new Error('Hook executarCiclo não encontrado');
  worker=worker.replace(old,old+"\n  const agoraLembretes=Date.now();\n  if(agoraLembretes-ultimaChecagemLembretes>=60000){\n    ultimaChecagemLembretes=agoraLembretes;\n    try{const lr=await agendaLembretes.processarLembretes();if(lr&&lr.enviados)console.log('[agenda.lembretes] enviados',lr.enviados);}\n    catch(erro){console.error('[agenda.lembretes] falha',{tipo:erro?.name||'Error',codigo:erro?.code||null});}\n  }");
}
write('src/services/whatsappWorker.service.js',worker);

cp.execFileSync(process.execPath,['--check','src/services/agendaLembretes.service.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','src/services/whatsappWorker.service.js'],{stdio:'inherit'});
console.log('Lembretes automáticos da agenda aplicados.');
