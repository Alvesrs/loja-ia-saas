const fs = require('node:fs');
const cp = require('node:child_process');
const file = 'src/services/agendaWhatsapp.service.js';
let source = fs.readFileSync(file, 'utf8');

if (!/^const GATILHO_CONFIRMAR_LEMBRETE=/m.test(source)) {
  const anchor = "const GATILHO_CANCELAR=";
  if (!source.includes(anchor)) throw new Error('Gatilho de cancelamento ausente');
  source = source.replace(anchor,
    "const GATILHO_CONFIRMAR_LEMBRETE=/^(confirmar|confirmo|confirmado)$/i;\n" + anchor);
}

if (!/^async function lembretesPendentesContato\(/m.test(source)) {
  const anchor = 'async function tentarResponder(mensagem){';
  if (!source.includes(anchor)) throw new Error('Atendente da agenda ausente');
  const helpers = `async function lembretesPendentesContato(lojaId, contato){
  const agora=new Date(), limite=new Date(agora.getTime()+30*60*60*1000);
  const {data:ags,error}=await supabase.from('saintsai_agendamentos')
    .select('id,servico_id,cliente_nome,inicio,fim,status,pagamento_status,saintsai_servicos(nome)')
    .eq('loja_id',lojaId).eq('cliente_whatsapp',contato).eq('status','confirmado')
    .gte('inicio',agora.toISOString()).lte('inicio',limite.toISOString())
    .order('inicio',{ascending:true}).limit(8);
  if(error)throw error;
  if(!(ags||[]).length)return [];
  const ids=ags.map(a=>a.id);
  const {data:lembretes,error:erroLembretes}=await supabase.from('saintsai_agenda_lembretes')
    .select('agendamento_id').in('agendamento_id',ids).eq('tipo','24h').eq('status','enviado');
  if(erroLembretes)throw erroLembretes;
  const enviados=new Set((lembretes||[]).map(x=>x.agendamento_id));
  return ags.filter(a=>enviados.has(a.id));
}
async function confirmarAgendamentoCliente(lojaId,id){
  const {data,error}=await supabase.from('saintsai_agendamentos')
    .update({confirmado_cliente_em:new Date().toISOString(),atualizado_em:new Date().toISOString()})
    .eq('id',id).eq('loja_id',lojaId).eq('status','confirmado')
    .select('id,inicio').maybeSingle();
  if(error)throw error;
  return data;
}
`;
  source = source.replace(anchor, helpers + anchor);
}

for (const name of ['GATILHO_CONFIRMAR_LEMBRETE', 'lembretesPendentesContato', 'confirmarAgendamentoCliente']) {
  if (!source.includes(name)) throw new Error('Definição de lembrete ausente: ' + name);
}
fs.writeFileSync(file, source);
cp.execFileSync(process.execPath, ['--check', file], {stdio:'inherit'});
