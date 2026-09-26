
const crypto=require('node:crypto');
const supabase=require('../config/supabase');
const supabaseAuth=require('../config/supabaseAuth');
const {usuarioEhAdmin}=require('../middleware/admin');

const BUCKET='servico-imagens';
const MIME=Object.freeze({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'});
const MAX_BYTES=3*1024*1024;

async function podeAcessar(lojaId,usuario){
  const {data:loja,error}=await supabase.from('lojas').select('id,dono_id').eq('id',lojaId).maybeSingle();
  if(error)throw error;
  if(!loja)return false;
  if(loja.dono_id===usuario.id)return true;
  if(usuarioEhAdmin(usuario)){
    try{
      const {data}=await supabaseAuth.auth.admin.getUserById(loja.dono_id);
      return data?.user?.app_metadata?.saintsai_managed===true;
    }catch(_){return false;}
  }
  return false;
}

async function garantirBucket(){
  const {data,error}=await supabase.storage.getBucket(BUCKET);
  if(!error&&data)return;
  const r=await supabase.storage.createBucket(BUCKET,{
    public:true,
    allowedMimeTypes:Object.keys(MIME),
    fileSizeLimit:MAX_BYTES,
  });
  if(r.error&&!/already|exist/i.test(String(r.error.message||'')))throw r.error;
}

async function upload(req,res){
  try{
    const lojaId=String(req.params.lojaId||'');
    if(!(await podeAcessar(lojaId,req.usuario))){
      return res.status(403).json({erro:'Você não tem acesso a essa loja.'});
    }

    const raw=String(req.body?.data_url||'');
    const m=raw.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if(!m)return res.status(400).json({erro:'Use uma foto JPG, PNG ou WEBP.'});

    const buffer=Buffer.from(m[2],'base64');
    if(!buffer.length||buffer.length>MAX_BYTES){
      return res.status(413).json({erro:'A foto deve ter no máximo 3 MB.'});
    }

    await garantirBucket();
    const caminho=lojaId+'/'+crypto.randomUUID()+'.'+MIME[m[1]];
    const {error}=await supabase.storage
      .from(BUCKET)
      .upload(caminho,buffer,{contentType:m[1],upsert:false,cacheControl:'3600'});
    if(error)throw error;

    const {data}=supabase.storage.from(BUCKET).getPublicUrl(caminho);
    if(!data?.publicUrl)throw new Error('url_publica_ausente');

    return res.status(201).json({imagem_url:data.publicUrl,imagem_path:caminho});
  }catch(e){
    console.error('[servico-imagem]',e?.message||e);
    return res.status(500).json({erro:'Não foi possível enviar a foto.'});
  }
}

module.exports={upload};
