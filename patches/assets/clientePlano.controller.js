const supabase=require('../config/supabase');
const supabaseAuth=require('../config/supabaseAuth');
const {usuarioEhAdmin}=require('../middleware/admin');
const {listarPlanos}=require('../config/planos');
const {obterSituacaoPlano}=require('../services/assinaturas.service');
const {criarPixPlano}=require('../services/asaas.service');

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

function resumoCobranca(c){
  return {
    id:c.id,
    plano:c.plano,
    provedor:c.provedor,
    status:c.status_provider,
    criado_em:c.criado_em,
    atualizado_em:c.atualizado_em
  };
}

async function resumo(req,res){
  try{
    const lojaId=String(req.params.lojaId||'');
    const loja=await podeAcessar(lojaId,req.usuario);
    if(!loja)return res.status(403).json({erro:'Você não tem acesso a essa loja.'});

    const [situacao,hist]=await Promise.all([
      obterSituacaoPlano(lojaId),
      supabase.from('cobrancas_assinaturas')
        .select('id,plano,provedor,status_provider,criado_em,atualizado_em')
        .eq('loja_id',lojaId)
        .order('criado_em',{ascending:false})
        .limit(30)
    ]);
    if(hist.error)throw hist.error;

    const planos=listarPlanos().map(p=>({
      codigo:p.codigo,
      nome:p.nome,
      descricao:p.descricao||'',
      limiteMensagensMes:p.limiteMensagensMes,
      precoMensalCentavos:Number(p.precoMensalCentavos||0),
      vendavel:Boolean(p.vendavel)
    }));

    return res.json({
      loja:{id:loja.id,nome:loja.nome},
      situacao,
      planos,
      cobranca:{
        configurada:Boolean(process.env.ASAAS_API_KEY&&process.env.PUBLIC_BASE_URL),
        ambiente:String(process.env.ASAAS_ENVIRONMENT||'sandbox').toLowerCase()==='production'?'production':'sandbox'
      },
      historico:(hist.data||[]).map(resumoCobranca)
    });
  }catch(e){
    console.error('[cliente-plano] resumo',e?.message||e);
    return res.status(500).json({erro:'Não foi possível carregar seu plano agora.'});
  }
}

async function gerarPix(req,res){
  try{
    const lojaId=String(req.params.lojaId||'');
    const loja=await podeAcessar(lojaId,req.usuario);
    if(!loja)return res.status(403).json({erro:'Você não tem acesso a essa loja.'});

    const plano=String(req.body?.plano||'').trim();
    const duracao=Number(req.body?.duracao_meses);
    if(![1,3,6,12].includes(duracao))return res.status(400).json({erro:'Escolha 1, 3, 6 ou 12 meses.'});

    const resultado=await criarPixPlano({lojaId,planoCodigo:plano,duracaoMeses:duracao});
    return res.status(201).json(resultado);
  }catch(e){
    const m=String(e?.message||'');
    if(m==='plano_nao_vendavel')return res.status(400).json({erro:'Este plano não está disponível para compra.'});
    if(m==='preco_nao_configurado')return res.status(503).json({erro:'O preço deste plano ainda não foi configurado.'});
    if(m==='asaas_nao_configurado')return res.status(503).json({erro:'O pagamento do SaintsAI está temporariamente indisponível.'});
    if(m==='pix_chave_ausente')return res.status(503).json({erro:'O Pix do SaintsAI está temporariamente indisponível.'});
    console.error('[cliente-plano] pix',m||e);
    return res.status(502).json({erro:'Não foi possível gerar o Pix agora.'});
  }
}
module.exports={resumo,gerarPix};
