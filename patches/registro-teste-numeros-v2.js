const fs=require('node:fs');

function read(p){return fs.readFileSync(p,'utf8');}
function write(p,s){fs.writeFileSync(p,s);}

// Corrige o salvamento dos números: não depende de uma configuração WhatsApp pré-existente.
let c=read('src/controllers/admin.controller.js');
const re=/async function atualizarContatosClienteGerenciado\(req,res\)\{[\s\S]*?\n\}\n\nasync function atualizarPersonalidadeClienteGerenciado/;
const fn=`async function atualizarContatosClienteGerenciado(req,res){
  const lojaId=String(req.params.lojaId||'');
  const numeroDono=normalizarNumeroAdmin(req.body?.numero_dono_whatsapp);
  const numeroAgente=normalizarNumeroAdmin(req.body?.numero_whatsapp);

  if(!ehUuid(lojaId)) return res.status(400).json({erro:'Cliente inválido.'});
  if(numeroDono && (numeroDono.length<10 || numeroDono.length>15)) return res.status(400).json({erro:'Número do dono inválido.'});
  if(numeroAgente && (numeroAgente.length<10 || numeroAgente.length>15)) return res.status(400).json({erro:'Número do agente inválido.'});

  try{
    const {data:loja,error}=await supabase.from('lojas').select('id').eq('id',lojaId).maybeSingle();
    if(error||!loja) return res.status(404).json({erro:'Cliente não encontrado.'});

    const {error:erroLoja}=await supabase.from('lojas')
      .update({numero_dono_whatsapp:numeroDono||null}).eq('id',lojaId);
    if(erroLoja) throw erroLoja;

    if(numeroAgente){
      const {data:configs,error:erroConfigs}=await supabase.from('whatsapp_configuracoes')
        .select('id,ativo').eq('loja_id',lojaId).order('created_at',{ascending:false});
      if(erroConfigs) throw erroConfigs;

      const atual=Array.isArray(configs)?(configs.find(x=>x.ativo)||configs[0]):null;
      if(atual){
        const {error:erroNumero}=await supabase.from('whatsapp_configuracoes')
          .update({numero_whatsapp:numeroAgente,updated_at:new Date().toISOString()})
          .eq('id',atual.id).eq('loja_id',lojaId);
        if(erroNumero) throw erroNumero;
      }else{
        const {error:erroCriar}=await supabase.from('whatsapp_configuracoes').insert({
          loja_id:lojaId,
          provedor:'waha',
          numero_whatsapp:numeroAgente,
          identificador_externo:null,
          ativo:false
        });
        if(erroCriar) throw erroCriar;
      }
    }

    return res.json({ok:true,numero_whatsapp:numeroAgente||null,numero_dono_whatsapp:numeroDono||null});
  }catch(erro){
    console.error('[admin] atualizar contatos:',erro?.message||erro);
    return res.status(500).json({erro:'Não foi possível salvar os números do cliente.'});
  }
}

async function atualizarPersonalidadeClienteGerenciado`;

if(!re.test(c)) throw new Error('Função atualizarContatosClienteGerenciado não encontrada.');
c=c.replace(re,fn);
write('src/controllers/admin.controller.js',c);

// No Registro Teste, procura primeiro por um cliente existente pelo e-mail.
// Isso evita tentar criar novamente um login que foi criado numa tentativa anterior.
let h=read('public/admin-mobile.html');
h=h.replace(
  "let id=null;\n  try{\n   const r=await apiFetch('/admin/clientes',{method:'POST',body:JSON.stringify({nome,email,senha})});\n   id=r?.loja?.id||null;\n  }catch(e){",
  "let id=null;\n  const xsAntes=await apiFetch('/admin/clientes-gerenciados');\n  const existenteAntes=(Array.isArray(xsAntes)?xsAntes:[]).find(c=>String(c.email||c.username||'').trim().toLowerCase()===email);\n  if(existenteAntes?.loja_id){id=existenteAntes.loja_id;st.textContent='Cliente existente encontrado. Atualizando o registro de teste…';}\n  try{\n   if(!id){const r=await apiFetch('/admin/clientes',{method:'POST',body:JSON.stringify({nome,email,senha})});id=r?.loja?.id||null;}\n  }catch(e){"
);
write('public/admin-mobile.html',h);

console.log('Registro Teste: e-mail existente reutilizado e números salvos mesmo sem configuração WhatsApp prévia.');
