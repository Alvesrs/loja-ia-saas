const supabase=require('../config/supabase');
const supabaseAuth=require('../config/supabaseAuth');
const {usuarioEhAdmin}=require('../middleware/admin');

async function podeAcessar(lojaId,usuario){
  const {data:loja,error}=await supabase.from('lojas').select('id,dono_id,nome').eq('id',lojaId).maybeSingle();
  if(error)throw error;
  if(!loja)return null;
  if(loja.dono_id===usuario.id)return loja;
  if(usuarioEhAdmin(usuario)){
    try{
      const {data}=await supabaseAuth.auth.admin.getUserById(loja.dono_id);
      if(data?.user?.app_metadata?.saintsai_managed===true)return loja;
    }catch(_){}
  }
  return null;
}

function boundsSP(){
  const now=new Date();
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const [y,m]=today.split('-').map(Number);
  const next=new Date(Date.UTC(y,m,1));
  const nextY=next.getUTCFullYear(),nextM=String(next.getUTCMonth()+1).padStart(2,'0');
  const monthStart=`${y}-${String(m).padStart(2,'0')}-01T00:00:00-03:00`;
  const monthEnd=`${nextY}-${nextM}-01T00:00:00-03:00`;
  const dayStart=`${today}T00:00:00-03:00`;
  const dayEnd=new Date(new Date(dayStart).getTime()+86400000).toISOString();
  return {
    today,
    dayStart:new Date(dayStart).toISOString(),
    dayEnd,
    monthStart:new Date(monthStart).toISOString(),
    monthEnd:new Date(monthEnd).toISOString()
  };
}
function sum(rows){return (rows||[]).reduce((a,x)=>a+Number(x.valor||0),0);}
function validSale(x){return !['cancelado','nao_compareceu'].includes(String(x.status||''));}
function pending(x){
  if(['cancelado','nao_compareceu'].includes(String(x.status||'')))return false;
  if(String(x.pagamento_status||'')==='pago')return false;
  if(String(x.pagamento_status||'')==='estornado')return false;
  return ['pendente','aguardando','presencial'].includes(String(x.pagamento_status||''));
}
function mapRecord(x){
  return {
    id:x.id,
    nome:x.cliente_nome||'Cliente',
    servico:x.saintsai_servicos?.nome||'Atendimento',
    imagem_url:x.saintsai_servicos?.imagem_url||null,
    profissional:x.saintsai_profissionais?.nome||null,
    inicio:x.inicio,
    criado_em:x.criado_em,
    valor:Number(x.valor||0),
    status:x.status,
    pagamento_status:x.pagamento_status
  };
}

async function resumo(req,res){
  try{
    const lojaId=String(req.params.lojaId||'');
    const loja=await podeAcessar(lojaId,req.usuario);
    if(!loja)return res.status(403).json({erro:'Você não tem acesso a essa loja.'});

    const b=boundsSP();
    const [
      vendidosMesR,
      recebidosMesR,
      canceladosMesR,
      pendentesR,
      clientesHojeR,
      recentesR
    ]=await Promise.all([
      supabase.from('saintsai_agendamentos')
        .select('id,valor,status,pagamento_status,criado_em')
        .eq('loja_id',lojaId).gte('criado_em',b.monthStart).lt('criado_em',b.monthEnd),
      supabase.from('saintsai_agendamentos')
        .select('id,valor,status,pagamento_status,pagamento_pago_em')
        .eq('loja_id',lojaId).gte('pagamento_pago_em',b.monthStart).lt('pagamento_pago_em',b.monthEnd)
        .neq('pagamento_status','estornado'),
      supabase.from('saintsai_agendamentos')
        .select('id,valor,status,cancelado_em')
        .eq('loja_id',lojaId).gte('cancelado_em',b.monthStart).lt('cancelado_em',b.monthEnd),
      supabase.from('saintsai_agendamentos')
        .select('id,valor,status,pagamento_status,inicio')
        .eq('loja_id',lojaId).in('pagamento_status',['pendente','aguardando','presencial'])
        .neq('status','cancelado').neq('status','nao_compareceu'),
      supabase.from('saintsai_agendamentos')
        .select('id,status,inicio')
        .eq('loja_id',lojaId).gte('inicio',b.dayStart).lt('inicio',b.dayEnd)
        .not('status','in','(cancelado,nao_compareceu)'),
      supabase.from('saintsai_agendamentos')
        .select('id,cliente_nome,inicio,valor,status,pagamento_status,criado_em,saintsai_servicos(nome,imagem_url),saintsai_profissionais(nome)')
        .eq('loja_id',lojaId).order('criado_em',{ascending:false}).limit(20)
    ]);
    const err=[vendidosMesR,recebidosMesR,canceladosMesR,pendentesR,clientesHojeR,recentesR].find(x=>x.error)?.error;
    if(err)throw err;

    const vendidosMes=(vendidosMesR.data||[]).filter(validSale);
    const vendidosHoje=vendidosMes.filter(x=>new Date(x.criado_em)>=new Date(b.dayStart)&&new Date(x.criado_em)<new Date(b.dayEnd));
    const recebidosMes=recebidosMesR.data||[];
    const recebidosHoje=recebidosMes.filter(x=>new Date(x.pagamento_pago_em)>=new Date(b.dayStart)&&new Date(x.pagamento_pago_em)<new Date(b.dayEnd));
    const canceladosMes=canceladosMesR.data||[];
    const canceladosHoje=canceladosMes.filter(x=>new Date(x.cancelado_em)>=new Date(b.dayStart)&&new Date(x.cancelado_em)<new Date(b.dayEnd));
    const pendentes=(pendentesR.data||[]).filter(pending);
    const pendentesMes=vendidosMes.filter(pending);
    const vendidoMes=sum(vendidosMes);
    const ticketMedio=vendidosMes.length?vendidoMes/vendidosMes.length:0;

    return res.json({
      periodo:{hoje:b.today},
      hoje:{
        vendido:sum(vendidosHoje),
        vendido_quantidade:vendidosHoje.length,
        recebido:sum(recebidosHoje),
        recebido_quantidade:recebidosHoje.length,
        cancelado:sum(canceladosHoje),
        cancelado_quantidade:canceladosHoje.length,
        clientes:Number((clientesHojeR.data||[]).length)
      },
      aberto:{
        receber:sum(pendentes),
        quantidade:pendentes.length
      },
      mes:{
        vendido:vendidoMes,
        vendido_quantidade:vendidosMes.length,
        recebido:sum(recebidosMes),
        recebido_quantidade:recebidosMes.length,
        pendente:sum(pendentesMes),
        pendente_quantidade:pendentesMes.length,
        cancelado:sum(canceladosMes),
        cancelado_quantidade:canceladosMes.length,
        ticket_medio:ticketMedio
      },
      registros:(recentesR.data||[]).map(mapRecord)
    });
  }catch(e){
    console.error('[cliente-financeiro]',e?.message||e);
    return res.status(500).json({erro:'Não foi possível carregar o resumo financeiro.'});
  }
}
module.exports={resumo};
