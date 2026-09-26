const supabase=require('../config/supabase');

function horaValida(v){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v||''));}
function hmMin(v){const m=String(v||'').match(/^(\d{2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null;}
function isoLocal(data,hora){return String(data)+'T'+String(hora)+':00-03:00';}
function duracao(servico){return Number(servico?.duracao_min||0)+Number(servico?.intervalo_pos_min||0);}

function limparHorarios(raw){
  if(raw===null||raw===undefined||raw==='')return null;
  if(typeof raw!=='object'||Array.isArray(raw))throw new Error('horarios_invalidos');
  const out={};
  let tem=false;
  for(let d=0;d<7;d++){
    const x=raw[String(d)]||{};
    if(x.aberto===true){
      const inicio=String(x.inicio||''),fim=String(x.fim||'');
      if(!horaValida(inicio)||!horaValida(fim)||inicio>=fim)throw new Error('horarios_invalidos');
      out[String(d)]={aberto:true,inicio,fim};tem=true;
    }else out[String(d)]={aberto:false};
  }
  return tem?out:null;
}

async function listar(lojaId,{somenteAtivos=false}={}){
  let q=supabase.from('saintsai_profissionais').select('id,loja_id,nome,ativo,horarios,criado_em,atualizado_em').eq('loja_id',lojaId).order('nome');
  if(somenteAtivos)q=q.eq('ativo',true);
  const {data:pros,error}=await q;if(error)throw error;
  const ids=(pros||[]).map(x=>x.id);
  let links=[];
  if(ids.length){
    const r=await supabase.from('saintsai_profissional_servicos').select('profissional_id,servico_id').eq('loja_id',lojaId).in('profissional_id',ids);
    if(r.error)throw r.error;links=r.data||[];
  }
  const map=new Map();
  for(const l of links){if(!map.has(l.profissional_id))map.set(l.profissional_id,[]);map.get(l.profissional_id).push(l.servico_id);}
  return (pros||[]).map(p=>({...p,servico_ids:map.get(p.id)||[],usa_horario_geral:!p.horarios}));
}

async function salvarServicos(lojaId,profissionalId,servicoIds){
  const ids=[...new Set((servicoIds||[]).map(String).filter(Boolean))];
  if(ids.length){
    const {data:sv,error}=await supabase.from('saintsai_servicos').select('id').eq('loja_id',lojaId).in('id',ids);
    if(error)throw error;
    if((sv||[]).length!==ids.length)throw new Error('servico_invalido');
  }
  const {error:del}=await supabase.from('saintsai_profissional_servicos').delete().eq('loja_id',lojaId).eq('profissional_id',profissionalId);
  if(del)throw del;
  if(ids.length){
    const {error}=await supabase.from('saintsai_profissional_servicos').insert(ids.map(servico_id=>({loja_id:lojaId,profissional_id:profissionalId,servico_id})));
    if(error)throw error;
  }
}

async function criar(lojaId,{nome,servico_ids,horarios}){
  const n=String(nome||'').trim();
  if(n.length<2||n.length>100)throw new Error('nome_invalido');
  const hs=limparHorarios(horarios);
  const {data,error}=await supabase.from('saintsai_profissionais').insert({loja_id:lojaId,nome:n,horarios:hs,ativo:true}).select('*').single();
  if(error)throw error;
  try{await salvarServicos(lojaId,data.id,servico_ids||[]);}catch(e){await supabase.from('saintsai_profissionais').delete().eq('id',data.id).eq('loja_id',lojaId);throw e;}
  return (await listar(lojaId)).find(x=>x.id===data.id);
}

async function atualizar(lojaId,id,{nome,servico_ids,horarios,ativo}){
  const dados={atualizado_em:new Date().toISOString()};
  if(nome!==undefined){const n=String(nome||'').trim();if(n.length<2||n.length>100)throw new Error('nome_invalido');dados.nome=n;}
  if(horarios!==undefined)dados.horarios=limparHorarios(horarios);
  if(ativo!==undefined)dados.ativo=Boolean(ativo);
  const {data,error}=await supabase.from('saintsai_profissionais').update(dados).eq('id',id).eq('loja_id',lojaId).select('id').maybeSingle();
  if(error)throw error;if(!data)throw new Error('profissional_nao_encontrado');
  if(servico_ids!==undefined)await salvarServicos(lojaId,id,servico_ids);
  return (await listar(lojaId)).find(x=>x.id===id);
}

async function desativar(lojaId,id){
  const {data,error}=await supabase.from('saintsai_profissionais').update({ativo:false,atualizado_em:new Date().toISOString()}).eq('id',id).eq('loja_id',lojaId).select('id').maybeSingle();
  if(error)throw error;if(!data)throw new Error('profissional_nao_encontrado');
  return true;
}

async function elegiveisParaServico(lojaId,servicoId){
  const pros=await listar(lojaId,{somenteAtivos:true});
  return pros.filter(p=>p.servico_ids.length===0||p.servico_ids.includes(String(servicoId)));
}

function regraDoDia(pro,cfg,data){
  const dia=String(new Date(String(data)+'T12:00:00Z').getUTCDay());
  const fonte=pro?.horarios&&typeof pro.horarios==='object'?pro.horarios:(cfg?.horarios||{});
  return fonte?.[dia]||null;
}

function cabeNoHorario(pro,cfg,data,hora,servico){
  const regra=regraDoDia(pro,cfg,data);
  if(!regra||regra.aberto!==true||!horaValida(regra.inicio)||!horaValida(regra.fim))return false;
  const ini=hmMin(regra.inicio),fim=hmMin(regra.fim),h=hmMin(hora),dur=duracao(servico);
  return h!==null&&dur>0&&h>=ini&&h+dur<=fim;
}

function conflita(ocupados,profissionalId,a,b){
  return (ocupados||[]).some(x=>{
    const mesmo=profissionalId?String(x.profissional_id||'')===String(profissionalId):!x.profissional_id;
    return mesmo&&new Date(x.inicio)<b&&new Date(x.fim)>a&&x.status!=='cancelado';
  });
}

async function ocupadosPeriodo(lojaId,inicio,fim,ignorarId=null){
  let q=supabase.from('saintsai_agendamentos').select('id,profissional_id,inicio,fim,status').eq('loja_id',lojaId).neq('status','cancelado').gte('inicio',inicio).lt('inicio',fim);
  const {data,error}=await q;if(error)throw error;
  return (data||[]).filter(x=>!ignorarId||x.id!==ignorarId);
}

async function slotsDia(lojaId,servico,data,cfg,{profissionalId=null,ignorarId=null,ocupados=null}={}){
  let pros=await elegiveisParaServico(lojaId,servico.id);
  if(profissionalId)pros=pros.filter(p=>p.id===profissionalId);
  const legacy=pros.length===0;
  const recursos=legacy?[{id:null,nome:null,horarios:null}]:pros;
  const passo=Math.max(5,Number(cfg?.intervalo_grade_min||30));
  const diaIni=new Date(isoLocal(data,'00:00')),diaFim=new Date(diaIni.getTime()+86400000);
  const occ=ocupados||await ocupadosPeriodo(lojaId,diaIni.toISOString(),diaFim.toISOString(),ignorarId);
  const out=[];
  for(let m=0;m<24*60;m+=passo){
    const hora=String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
    const a=new Date(isoLocal(data,hora)),b=new Date(a.getTime()+duracao(servico)*60000);
    if(a.getTime()<Date.now())continue;
    const livres=recursos.filter(p=>cabeNoHorario(p,cfg,data,hora,servico)&&!conflita(occ,p.id,a,b));
    if(livres.length)out.push({hora,profissionais:livres.map(p=>p.id).filter(Boolean)});
  }
  return out;
}

async function escolherDisponivel(lojaId,servico,data,hora,cfg,{profissionalId=null,ignorarId=null}={}){
  let pros=await elegiveisParaServico(lojaId,servico.id);
  if(profissionalId){
    const p=pros.find(x=>x.id===profissionalId);if(!p)return null;pros=[p];
  }
  const legacy=pros.length===0;
  const recursos=legacy?[{id:null,nome:null,horarios:null}]:pros;
  const a=new Date(isoLocal(data,hora)),b=new Date(a.getTime()+duracao(servico)*60000);
  const occ=await ocupadosPeriodo(lojaId,new Date(a.getTime()-86400000).toISOString(),new Date(b.getTime()+86400000).toISOString(),ignorarId);
  return recursos.find(p=>cabeNoHorario(p,cfg,data,hora,servico)&&!conflita(occ,p.id,a,b))||null;
}

module.exports={limparHorarios,listar,criar,atualizar,desativar,elegiveisParaServico,slotsDia,escolherDisponivel};
