const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}
let a=read('src/services/agendaWhatsapp.service.js');
if(!a.includes("pagBankPix")){
 a=a.replace("const llm=require('./llm.service');","const llm=require('./llm.service');\nconst pagBankPix=require('./pagBankPix.service');");
 const cfg="  const cfg=await config(lojaId);";
 if(!a.includes(cfg))throw new Error('Config agenda não encontrada');
 a=a.replace(cfg,cfg+"\n  const {data:pagCfg}=await supabase.from('saintsai_pagamento_config').select('provedor,conectado,aceita_pix_online').eq('loja_id',lojaId).maybeSingle();");
 const start="  if(!ativo)estado={ativo:true};";
 a=a.replace(start,start+"\n  if(estado.aguardando_pagamento_metodo){const n=normalizar(texto);if(/pix.*(agora|online)|^pix$/.test(n)){estado.pagamento_metodo='pix_online';estado.aguardando_pagamento_metodo=false;await salvarEstado(lojaId,contato,estado);}else if(/presencial|dinheiro|cartao|cartão|pagar.*local/.test(n)){estado.pagamento_metodo='presencial';estado.aguardando_pagamento_metodo=false;await salvarEstado(lojaId,contato,estado);}else return 'Você prefere pagar por PIX agora ou pagar presencialmente no atendimento?';}");
 const ret="  return {agendamento:data};\n}";
 if(!a.includes(ret))throw new Error('Retorno criar não encontrado');
 a=a.replace(ret,"  if(metodo==='pix_online'&&pag?.provedor==='pagbank'){try{const pix=await pagBankPix.criarPixParaAgendamento({...data,loja_id:lojaId,valor:Number(servico.preco||0)},servico);return {agendamento:data,pix};}catch(e){await supabase.from('saintsai_agendamentos').update({status:'cancelado',pagamento_status:'cancelado',atualizado_em:new Date().toISOString()}).eq('id',data.id).eq('loja_id',lojaId);return {pagamentoErro:true};}}\n  return {agendamento:data};\n}");
 const cr="    const r=await criar(lojaId,contato,servico,estado);\n    if(r.conflito)";
 if(!a.includes(cr))throw new Error('Criação confirmada não encontrada');
 a=a.replace(cr,"    const r=await criar(lojaId,contato,servico,estado);\n    if(r.pagamentoErro){await limparEstado(lojaId,contato);return 'Não consegui gerar o PIX agora. O horário não foi reservado. Podemos tentar novamente ou escolher pagamento presencial.';}\n    if(r.conflito)");
 const ok="    await limparEstado(lojaId,contato);\n    return 'Agendamento confirmado: '+servico.nome+' em '+brData(estado.data)+' às '+estado.hora+'.';";
 a=a.replace(ok,"    await limparEstado(lojaId,contato);\n    if(r.pix)return 'Horário reservado por alguns minutos para '+servico.nome+' em '+brData(estado.data)+' às '+estado.hora+'. Pague o PIX para confirmar. Copia e cola:\\n'+r.pix.qrText;\n    return 'Agendamento confirmado: '+servico.nome+' em '+brData(estado.data)+' às '+estado.hora+'.';");
 const fin="  estado.aguardando_confirmacao=true;await salvarEstado(lojaId,contato,estado);";
 if(!a.includes(fin))throw new Error('Confirmação final não encontrada');
 a=a.replace(fin,"  if(!estado.pagamento_metodo&&pagCfg?.provedor==='pagbank'&&pagCfg?.conectado===true&&pagCfg?.aceita_pix_online===true){estado.aguardando_pagamento_metodo=true;await salvarEstado(lojaId,contato,estado);return 'Você prefere pagar por PIX agora ou pagar presencialmente no atendimento?';}\n  if(!estado.pagamento_metodo)estado.pagamento_metodo='presencial';\n"+fin);
}
write('src/services/agendaWhatsapp.service.js',a);
cp.execFileSync(process.execPath,['--check','src/services/agendaWhatsapp.service.js'],{stdio:'inherit'});
console.log('Pix PagBank integrado ao fluxo da agenda.');