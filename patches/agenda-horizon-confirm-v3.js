const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

let svc=read('src/services/agendaWhatsapp.service.js');
if(!svc.includes('GATILHO_CONFIRMAR_LEMBRETE')){
  svc=svc.replace(
    "const GATILHO_REAGENDAR=/\\\\b(reagendar|reagendo|remarcar|remarca|mudar.*hor[aá]rio|trocar.*hor[aá]rio|alterar.*hor[aá]rio)\\\\b/i;",
    "const GATILHO_REAGENDAR=/\\\\b(reagendar|reagendo|remarcar|remarca|mudar.*hor[aá]rio|trocar.*hor[aá]rio|alterar.*hor[aá]rio)\\\\b/i;\\nconst GATILHO_CONFIRMAR_LEMBRETE=/^(confirmar|confirmo|confirmado)$/i;"
  );
  svc=svc.replace(
    "function brData(s){if(!dataValida(s))return s;const [a,m,d]=s.split('-');return d+'/'+m+'/'+a;}",
    "function brData(s){if(!dataValida(s))return s;const [a,m,d]=s.split('-');return d+'/'+m+'/'+a;}\\nfunction somarUmMesData(s){const [y,m,d]=String(s).split('-').map(Number);let ny=y,nm=m+1;if(nm>12){nm=1;ny+=1;}const ultimo=new Date(Date.UTC(ny,nm,0)).getUTCDate();return ny+'-'+String(nm).padStart(2,'0')+'-'+String(Math.min(d,ultimo)).padStart(2,'0');}\\nfunction limiteDataAgenda(){return somarUmMesData(hojeSP());}\\nfunction dataDentroHorizonte(s){return dataValida(s)&&s>=hojeSP()&&s<=limiteDataAgenda();}"
  );
  const before="async function tentarResponder(mensagem){";
  const helper=[
    "async function lembretesPendentesContato(lojaId,contato){",
    "  const agora=new Date(), limite=new Date(agora.getTime()+30*60*60*1000);",
    "  const {data:ags,error}=await supabase.from('saintsai_agendamentos').select('id,servico_id,cliente_nome,inicio,fim,status,confirmado_cliente_em,saintsai_servicos(nome)').eq('loja_id',lojaId).eq('cliente_whatsapp',contato).eq('status','confirmado').gte('inicio',agora.toISOString()).lte('inicio',limite.toISOString()).order('inicio',{ascending:true}).limit(8);",
    "  if(error)throw error;if(!(ags||[]).length)return [];",
    "  const ids=ags.map(a=>a.id);",
    "  const {data:lems,error:el}=await supabase.from('saintsai_agenda_lembretes').select('agendamento_id').in('agendamento_id',ids).eq('tipo','24h').eq('status','enviado');",
    "  if(el)throw el;const ok=new Set((lems||[]).map(x=>x.agendamento_id));return ags.filter(a=>ok.has(a.id));",
    "}",
    "async function confirmarAgendamentoCliente(lojaId,id){",
    "  const {data,error}=await supabase.from('saintsai_agendamentos').update({confirmado_cliente_em:new Date().toISOString(),atualizado_em:new Date().toISOString()}).eq('id',id).eq('loja_id',lojaId).eq('status','confirmado').select('id,inicio').maybeSingle();",
    "  if(error)throw error;return data;",
    "}",
    ""
  ].join("\\n");
  if(!svc.includes(before))throw new Error('Anchor tentarResponder não encontrado');
  svc=svc.replace(before,helper+before);

  const needle="  const ativo=Boolean(estado&&estado.ativo);";
  if(!svc.includes(needle))throw new Error('Fluxo ativo não encontrado');
  const repl=[
    "  const ativo=Boolean(estado&&estado.ativo);",
    "  const lembreteConfirmar=!ativo&&GATILHO_CONFIRMAR_LEMBRETE.test(normalizar(texto));",
    "  const lembreteCancelar=!ativo&&GATILHO_CANCELAR.test(texto);",
    "  if(lembreteConfirmar||lembreteCancelar){",
    "    const pendentes=await lembretesPendentesContato(lojaId,contato);",
    "    if(pendentes.length===1){",
    "      const ag=pendentes[0];",
    "      if(lembreteConfirmar){await confirmarAgendamentoCliente(lojaId,ag.id);return 'Presença confirmada. Seu horário continua reservado.';}",
    "      const cancelado=await cancelarAgendamento(lojaId,ag.id);",
    "      if(!cancelado)return 'Esse agendamento não está mais disponível.';",
    "      return cancelado.pagamento_status==='pago'?'Agendamento cancelado. O pagamento já consta como pago, então eventual estorno seguirá a política da empresa.':'Agendamento cancelado com sucesso.';",
    "    }",
    "    if(pendentes.length>1){",
    "      await salvarEstado(lojaId,contato,{ativo:true,modo:'lembrete_selecao',acao:lembreteConfirmar?'confirmar':'cancelar',opcoes:pendentes.map(a=>a.id)});",
    "      return 'Encontrei mais de um horário próximo. Qual você quer '+(lembreteConfirmar?'confirmar':'cancelar')+'?\\n'+pendentes.map(resumoAg).join('\\n')+'\\nResponda somente com o número.';",
    "    }",
    "  }",
    "  if(ativo&&estado.modo==='lembrete_selecao'){",
    "    const idx=escolhaIndice(texto,(estado.opcoes||[]).length);",
    "    if(idx===null)return 'Responda somente com o número do agendamento.';",
    "    const pendentes=await lembretesPendentesContato(lojaId,contato);",
    "    const ag=pendentes.find(x=>x.id===estado.opcoes[idx]);",
    "    if(!ag){await limparEstado(lojaId,contato);return 'Esse agendamento não está mais disponível.';}",
    "    if(estado.acao==='confirmar'){await confirmarAgendamentoCliente(lojaId,ag.id);await limparEstado(lojaId,contato);return 'Presença confirmada. Seu horário continua reservado.';}",
    "    const cancelado=await cancelarAgendamento(lojaId,ag.id);await limparEstado(lojaId,contato);",
    "    if(!cancelado)return 'Esse agendamento não está mais disponível.';",
    "    return cancelado.pagamento_status==='pago'?'Agendamento cancelado. O pagamento já consta como pago, então eventual estorno seguirá a política da empresa.':'Agendamento cancelado com sucesso.';",
    "  }"
  ].join("\\n");
  svc=svc.replace(needle,repl+"\\n"+needle);
  const x="  const x=await extrair(texto,servicos,estado);";
  if(!svc.includes(x))throw new Error('Extração não encontrada');
  svc=svc.replace(x,x+"\\n  if(dataValida(x.data)&&!dataDentroHorizonte(x.data)){estado.data=null;estado.hora=null;await salvarEstado(lojaId,contato,estado);return 'Posso marcar de hoje até '+brData(limiteDataAgenda())+'. Escolha uma data dentro desse período.';}");
  svc=svc.replace("  if(dataValida(x.data))estado.data=x.data;","  if(dataValida(x.data)&&dataDentroHorizonte(x.data))estado.data=x.data;");
}
write('src/services/agendaWhatsapp.service.js',svc);

let c=read('src/controllers/clienteHub.controller.js');
if(!c.includes('function dataHojeSP')){
  c=c.replace("function numero(v){const n=Number(v);return Number.isFinite(n)?n:null;}",
    "function numero(v){const n=Number(v);return Number.isFinite(n)?n:null;}\\nfunction dataHojeSP(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}\\nfunction somarUmMesData(s){const [y,m,d]=String(s).split('-').map(Number);let ny=y,nm=m+1;if(nm>12){nm=1;ny+=1;}const ultimo=new Date(Date.UTC(ny,nm,0)).getUTCDate();return ny+'-'+String(nm).padStart(2,'0')+'-'+String(Math.min(d,ultimo)).padStart(2,'0');}\\nfunction inicioDentroHorizonte(inicio){const t=inicio.getTime();const max=new Date(somarUmMesData(dataHojeSP())+'T23:59:59-03:00').getTime();return t>=Date.now()&&t<=max;}"
  );
}
c=c.replace("    const horarios=req.body?.horarios;\\n    const intervalo=Number(req.body?.intervalo_grade_min||30);",
"    const horarios=req.body?.horarios;\\n    const intervalo=Number(req.body?.intervalo_grade_min||30);\\n    const lembrete24=req.body?.lembrete_24h!==false;\\n    const lembrete2=req.body?.lembrete_2h!==false;");
c=c.replace("const {data,error}=await supabase.from('saintsai_agenda_config').upsert({loja_id:loja.id,timezone:'America/Sao_Paulo',intervalo_grade_min:intervalo,horarios:limpo,atualizado_em:new Date().toISOString()}",
"const {data,error}=await supabase.from('saintsai_agenda_config').upsert({loja_id:loja.id,timezone:'America/Sao_Paulo',intervalo_grade_min:intervalo,horarios:limpo,lembrete_24h:lembrete24,lembrete_2h:lembrete2,atualizado_em:new Date().toISOString()}");
c=c.replace("const inicio=new Date(req.body?.inicio);if(Number.isNaN(inicio.getTime()))return res.status(400).json({erro:'Horário inválido.'});",
"const inicio=new Date(req.body?.inicio);if(Number.isNaN(inicio.getTime()))return res.status(400).json({erro:'Horário inválido.'});if(!inicioDentroHorizonte(inicio))return res.status(400).json({erro:'Escolha uma data entre hoje e até 1 mês à frente.'});");
c=c.replace("const inicio=new Date(req.body.inicio);if(Number.isNaN(inicio.getTime())||inicio.getTime()<Date.now())return res.status(400).json({erro:'Novo horário inválido.'});",
"const inicio=new Date(req.body.inicio);if(Number.isNaN(inicio.getTime())||!inicioDentroHorizonte(inicio))return res.status(400).json({erro:'Escolha um novo horário entre hoje e até 1 mês à frente.'});");
write('src/controllers/clienteHub.controller.js',c);

console.log('Agenda horizonte e confirmação de lembrete aplicados.');
