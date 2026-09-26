const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

let s=read('src/services/pagBankPix.service.js');
if(!s.includes("const envio=require('./whatsappEnvio.service');")){
  const a="const supabase=require('../config/supabase');";
  if(!s.includes(a))throw new Error('Supabase require PagBank não encontrado');
  s=s.replace(a,a+"\nconst envio=require('./whatsappEnvio.service');");
}
if(!s.includes('async function enviarConfirmacaoPagamento')){
  const a='async function criarPixParaAgendamento(ag,servico){';
  if(!s.includes(a))throw new Error('Função criar Pix não encontrada');
  const helper=[
    "function formatarDataHora(inicio){",
    "  const d=new Date(inicio);",
    "  return {data:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(d),hora:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)};",
    "}",
    "async function enviarConfirmacaoPagamento(ag){",
    "  if(!ag?.id||!ag?.cliente_whatsapp)return false;",
    "  const agora=new Date().toISOString();",
    "  const {data:claim,error:ec}=await supabase.from('saintsai_agendamentos').update({pagamento_confirmacao_enviada_em:agora}).eq('id',ag.id).eq('loja_id',ag.loja_id).is('pagamento_confirmacao_enviada_em',null).select('id,loja_id,servico_id,cliente_whatsapp,inicio').maybeSingle();",
    "  if(ec)throw ec;if(!claim)return false;",
    "  try{",
    "    const [{data:cfgs,error:e1},{data:sv,error:e2}]=await Promise.all([",
    "      supabase.from('whatsapp_configuracoes').select('id,provedor,identificador_externo,ativo').eq('loja_id',claim.loja_id).eq('ativo',true).limit(10),",
    "      claim.servico_id?supabase.from('saintsai_servicos').select('nome').eq('id',claim.servico_id).eq('loja_id',claim.loja_id).maybeSingle():Promise.resolve({data:null,error:null})",
    "    ]);",
    "    if(e1||e2)throw (e1||e2);",
    "    const cfg=(cfgs||[]).find(x=>x.provedor==='waha')||(cfgs||[]).find(x=>x.provedor==='meta')||(cfgs||[])[0];",
    "    if(!cfg)throw new Error('sem_whatsapp');",
    "    const f=formatarDataHora(claim.inicio),nome=sv?.nome||'seu atendimento';",
    "    const texto='Pagamento confirmado ✅ Seu agendamento de '+nome+' está confirmado para '+f.data+' às '+f.hora+'.';",
    "    const idExterno='agenda-pag-'+claim.id;",
    "    const mensagem=Object.freeze({canal:'whatsapp',lojaId:claim.loja_id,configuracaoId:cfg.id,contato:claim.cliente_whatsapp,texto:'',idExterno,timestamp:new Date().toISOString()});",
    "    const resposta=Object.freeze({lojaId:claim.loja_id,contato:claim.cliente_whatsapp,idExterno,resposta:texto});",
    "    const contexto=Object.freeze({provedor:cfg.provedor,destinatarioId:cfg.identificador_externo});",
    "    await envio.enviarRespostaWhatsapp(mensagem,resposta,contexto);",
    "    return true;",
    "  }catch(e){",
    "    await supabase.from('saintsai_agendamentos').update({pagamento_confirmacao_enviada_em:null}).eq('id',claim.id).eq('loja_id',claim.loja_id);",
    "    throw e;",
    "  }",
    "}",
    ""
  ].join('\n');
  s=s.replace(a,helper+a);
}
const old="const {data,error}=await supabase.from('saintsai_agendamentos').update(u).eq('id',ag.id).eq('loja_id',ag.loja_id).select('*').maybeSingle();if(error)throw error;return data;";
if(!s.includes(old))throw new Error('Aplicação de status PagBank não encontrada');
s=s.replace(old,"const {data,error}=await supabase.from('saintsai_agendamentos').update(u).eq('id',ag.id).eq('loja_id',ag.loja_id).select('*').maybeSingle();if(error)throw error;if(ps==='PAID'&&data){try{await enviarConfirmacaoPagamento(data);}catch(e){console.error('[pagbank-confirmacao]',e?.message||e);}}return data;");
write('src/services/pagBankPix.service.js',s);
cp.execFileSync(process.execPath,['--check','src/services/pagBankPix.service.js'],{stdio:'inherit'});
console.log('Confirmação WhatsApp após pagamento PagBank aplicada.');