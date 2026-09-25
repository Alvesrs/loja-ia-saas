const fs=require('node:fs');
const p='src/services/wahaOnboarding.service.js';
let s=fs.readFileSync(p,'utf8');

if(!s.includes("const supabase=require('../config/supabase');")){
  s=s.replace(
    "const configuracoes=require('./whatsappConfiguracao.service');",
    "const configuracoes=require('./whatsappConfiguracao.service');\nconst supabase=require('../config/supabase');"
  );
}

const antigo = [
"async function obterOuCriarConfig(lojaId,fone,sessao){",
"  const itens=await configuracoes.listarConfiguracoesWhatsapp(lojaId);",
"  let cfg=itens.find(x=>x.provedor==='waha'&&x.ativo);",
"  if(cfg){",
"    if(cfg.identificador_externo!==sessao || cfg.numero_whatsapp!==fone){",
"      cfg=await configuracoes.atualizarConfiguracaoWhatsapp(cfg.id,lojaId,{numero_whatsapp:fone,identificador_externo:sessao,ativo:true});",
"    }",
"    return cfg;",
"  }",
"  return configuracoes.criarConfiguracaoWhatsapp({provedor:'waha',numero_whatsapp:fone,identificador_externo:sessao,ativo:true},lojaId);",
"}"
].join('\n');

const novo = [
"function canonNumero(valor){",
"  let d=String(valor||'').replace(/\\\\D/g,'');",
"  if(d.length===10||d.length===11)d='55'+d;",
"  return d;",
"}",
"async function liberarNumeroEmOutrasLojas(lojaId,fone){",
"  const alvo=canonNumero(fone);",
"  const {data,error}=await supabase.from('whatsapp_configuracoes')",
"    .select('id,loja_id,numero_whatsapp,identificador_externo,ativo,provedor')",
"    .eq('provedor','waha')",
"    .eq('ativo',true);",
"  if(error) throw new ErroWaha('Não foi possível verificar vínculos anteriores do número.',500);",
"",
"  const conflitos=(data||[]).filter(x=>x.loja_id!==lojaId&&canonNumero(x.numero_whatsapp)===alvo);",
"  for(const antigo of conflitos){",
"    if(antigo.identificador_externo){",
"      const removido=await chamar('/api/sessions/'+encodeURIComponent(antigo.identificador_externo),{method:'DELETE'});",
"      if(!removido.ok && removido.status!==404){",
"        throw new ErroWaha('Não foi possível liberar a conexão antiga deste número.',502);",
"      }",
"    }",
"    const {error:erroDesativar}=await supabase.from('whatsapp_configuracoes')",
"      .update({ativo:false,updated_at:new Date().toISOString()})",
"      .eq('id',antigo.id);",
"    if(erroDesativar) throw new ErroWaha('Não foi possível desativar o vínculo antigo deste número.',500);",
"  }",
"}",
"async function obterOuCriarConfig(lojaId,fone,sessao){",
"  const itens=await configuracoes.listarConfiguracoesWhatsapp(lojaId);",
"  let cfg=itens.find(x=>x.provedor==='waha'&&x.ativo) || itens.find(x=>x.provedor==='waha');",
"  if(cfg){",
"    if(cfg.identificador_externo!==sessao || cfg.numero_whatsapp!==fone || !cfg.ativo){",
"      cfg=await configuracoes.atualizarConfiguracaoWhatsapp(cfg.id,lojaId,{numero_whatsapp:fone,identificador_externo:sessao,ativo:true});",
"    }",
"    return cfg;",
"  }",
"  return configuracoes.criarConfiguracaoWhatsapp({provedor:'waha',numero_whatsapp:fone,identificador_externo:sessao,ativo:true},lojaId);",
"}"
].join('\n');

if(!s.includes(antigo)) throw new Error('Bloco obterOuCriarConfig não encontrado.');
s=s.replace(antigo,novo);

const alvoInicio="const fone=numero(phoneNumber), sessao=sessionName(lojaId), e=env();\n  await obterOuCriarConfig(lojaId,fone,sessao);";
const novoInicio="const fone=numero(phoneNumber), sessao=sessionName(lojaId), e=env();\n  await liberarNumeroEmOutrasLojas(lojaId,fone);\n  await obterOuCriarConfig(lojaId,fone,sessao);";
if(!s.includes(alvoInicio)) throw new Error('Início do pareamento não encontrado.');
s=s.replace(alvoInicio,novoInicio);

fs.writeFileSync(p,s);
console.log('WAHA: número repetido agora transfere o vínculo para o cliente atual.');
