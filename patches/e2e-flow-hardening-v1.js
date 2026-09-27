const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const os=require('node:os');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

fs.copyFileSync('patches/assets/bookingPublic-profissionais.service.js','src/services/bookingPublic.service.js');
fs.copyFileSync('patches/assets/agendar-profissionais.html','public/agendar.html');

let pix=read('src/services/pagBankPix.service.js');
const paidOld="if(ps==='PAID'){u.pagamento_status='pago';u.status='confirmado';}";
const paidNew="if(ps==='PAID'){u.pagamento_status='pago';if(!['cancelado','nao_compareceu'].includes(String(ag.status||'')))u.status='confirmado';}";
if(!pix.includes(paidOld))throw new Error('Regra PAID PagBank não encontrada');
pix=pix.replace(paidOld,paidNew);
const notifyOld="if(ps==='PAID'&&data){try{await enviarConfirmacaoPagamento(data);}catch(e){console.error('[pagbank-confirmacao]',e?.message||e);}}";
const notifyNew="if(ps==='PAID'&&data&&data.status==='confirmado'){try{await enviarConfirmacaoPagamento(data);}catch(e){console.error('[pagbank-confirmacao]',e?.message||e);}}";
if(!pix.includes(notifyOld))throw new Error('Confirmação PagBank não encontrada');
pix=pix.replace(notifyOld,notifyNew);
write('src/services/pagBankPix.service.js',pix);

let agenda=read('src/services/agendaWhatsapp.service.js');
const cancelOld=[
  "async function cancelarAgendamento(lojaId,id){",
  "  const {data,error}=await supabase.from('saintsai_agendamentos').update({status:'cancelado',atualizado_em:new Date().toISOString()})",
  "    .eq('id',id).eq('loja_id',lojaId).neq('status','cancelado').select('id,status,pagamento_status').maybeSingle();",
  "  if(error)throw error;return data;",
  "}"
].join('\n');
const cancelNew=[
  "async function cancelarAgendamento(lojaId,id){",
  "  const {data:atual,error:ea}=await supabase.from('saintsai_agendamentos')",
  "    .select('id,pagamento_status').eq('id',id).eq('loja_id',lojaId).maybeSingle();",
  "  if(ea)throw ea;if(!atual)return null;",
  "  const patch={status:'cancelado',atualizado_em:new Date().toISOString()};",
  "  if(['aguardando','pendente'].includes(String(atual.pagamento_status||'')))patch.pagamento_status='cancelado';",
  "  const {data,error}=await supabase.from('saintsai_agendamentos').update(patch)",
  "    .eq('id',id).eq('loja_id',lojaId).neq('status','cancelado').select('id,status,pagamento_status').maybeSingle();",
  "  if(error)throw error;return data;",
  "}"
].join('\n');
if(!agenda.includes(cancelOld))throw new Error('Função cancelarAgendamento não encontrada');
agenda=agenda.replace(cancelOld,cancelNew);
agenda=agenda.replace("if(error){if(error.code==='23P01')return {conflito:true};throw error;}","if(error){if(['23P01','23505'].includes(error.code))return {conflito:true};throw error;}");
write('src/services/agendaWhatsapp.service.js',agenda);

let bc=read('src/controllers/bookingPublic.controller.js');
bc=bc.replace("booking.disponibilidade(req.params.token,String(req.query.servico_id||''))","booking.disponibilidade(req.params.token,String(req.query.servico_id||''),req.query.profissional_id?String(req.query.profissional_id):null)");
write('src/controllers/bookingPublic.controller.js',bc);

for(const p of ['src/services/bookingPublic.service.js','src/controllers/bookingPublic.controller.js','src/services/pagBankPix.service.js','src/services/agendaWhatsapp.service.js'])cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});

const booking=read('src/services/bookingPublic.service.js');
for(const m of ["error.code==='23505'","aceita_dinheiro===true","aceita_pix_presencial===true","aceita_cartao_presencial===true"]){if(!booking.includes(m))throw new Error('Hardening do booking ausente: '+m);}
if(!pix.includes("!['cancelado','nao_compareceu'].includes"))throw new Error('PagBank ainda pode ressuscitar cancelamento');
if(!pix.includes("data.status==='confirmado'"))throw new Error('PagBank pode enviar confirmação indevida');
if(!agenda.includes("['23P01','23505'].includes(error.code)"))throw new Error('WhatsApp sem proteção de duplicidade');

const html=read('public/agendar.html');
if(!html.includes('Para cancelar ou reagendar depois'))throw new Error('Pós-agendamento sem orientação de gestão');
if(!html.includes('tentativas>360'))throw new Error('Polling Pix curto demais');
const re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;let m,n=0;
while((m=re.exec(html))){const code=m[1].trim();if(!code)continue;const tmp=path.join(os.tmpdir(),'saintsai-e2e-audit-'+(++n)+'.js');fs.writeFileSync(tmp,code);try{cp.execFileSync(process.execPath,['--check',tmp],{stdio:'inherit'});}finally{try{fs.unlinkSync(tmp)}catch(_){}}}
if(!n)throw new Error('Página pública sem JavaScript');
console.log('Auditoria E2E: duplicidade, cancelamento tardio, Pix, lembretes e pós-agendamento protegidos.');