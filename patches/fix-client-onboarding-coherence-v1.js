const fs=require('node:fs');
const cp=require('node:child_process');
const p='src/controllers/clienteHub.controller.js';
let s=fs.readFileSync(p,'utf8');

const a=s.indexOf('async function onboardingCliente(req,res){');
const b=s.indexOf('\nasync function ',a+20);
if(a<0||b<0)throw new Error('onboardingCliente não encontrado');
let fn=s.slice(a,b);

// Usa a mesma regra de acesso do restante do portal.
fn=fn.replace(
  /const lojaId=String\(req\.params\.lojaId\|\|''\);[\s\S]*?if\(!loja\)return res\.status\(404\)\.json\(\{erro:'Loja não encontrada\.'\}\);/,
  "const loja=await exigirLoja(req,res);if(!loja)return;\n    const lojaId=String(loja.id);\n    const {data:lojaDados,error:el}=await supabase.from('lojas').select('id,nome,prompt_mestre').eq('id',lojaId).maybeSingle();\n    if(el)throw el;\n    if(!lojaDados)return res.status(404).json({erro:'Loja não encontrada.'});"
);

// Prompt salvo e não vazio = concluído. Ignora apenas blocos automáticos.
fn=fn.replace(
  /const prompt=String\(loja\.prompt_mestre\|\|''\)[\s\S]*?\.trim\(\);/,
  "const prompt=String(lojaDados.prompt_mestre||'')\n      .replace(/\\[SAINTSAI_CONFIG_CLIENTE\\][\\s\\S]*?\\[\\/SAINTSAI_CONFIG_CLIENTE\\]/g,'')\n      .replace(/\\[SAINTSAI_DADOS_NEGOCIO\\][\\s\\S]*?\\[\\/SAINTSAI_DADOS_NEGOCIO\\]/g,'')\n      .trim();"
);

// Reconstrói as etapas numa ordem coerente e sem limite arbitrário de 40 caracteres.
const stepsRe=/const etapas=\[[\s\S]*?\n    \];/;
if(!stepsRe.test(fn))throw new Error('Bloco etapas não encontrado');
fn=fn.replace(stepsRe,`const etapas=[
      {id:'ia',titulo:'Configure a IA',descricao:'Defina o Prompt Mestre e como a IA deve atender.',concluida:prompt.length>0,destino:'ia'},
      {id:'servicos',titulo:'Cadastre seu trabalho',descricao:'Adicione pelo menos um serviço com preço, duração e detalhes.',concluida:Boolean(servicos&&servicos.length),destino:'servicos'},\n      {id:'equipe',titulo:'Configure sua equipe',descricao:'Cadastre pelo menos um profissional para atender os serviços.',concluida:Boolean(profissionaisOnboarding&&profissionaisOnboarding.length),destino:'equipe'},
      {id:'agenda',titulo:'Configure a agenda',descricao:'Escolha os dias, horários e intervalos de atendimento.',concluida:agendaOk,destino:'agenda'},
      {id:'pagamentos',titulo:'Configure pagamentos',descricao:'Defina como seus clientes podem pagar pelos atendimentos.',concluida:pagOk,destino:'pagamentos'},
      {id:'plano',titulo:'Escolha seu plano SaintsAI',descricao:'Escolha e ative o plano da sua assinatura SaintsAI.',concluida:planoOk,destino:'plano'},
      {id:'operacao',titulo:'Conecte e teste o WhatsApp',descricao:'Ative o WhatsApp e faça um teste antes de divulgar.',concluida:Boolean(wa&&wa.length),destino:'operacao'}
    ];`);

// Garante situacaoPlano/planoOk antes da lista, caso o patch anterior tenha inserido em posição diferente.
if(!fn.includes('const situacaoPlano=await obterSituacaoPlano(lojaId);')){
  const mark="if(e1||e2||e3||e4)throw (e1||e2||e3||e4);\n    const {data:profissionaisOnboarding,error:eProf}=await supabase.from('saintsai_profissionais').select('id').eq('loja_id',lojaId).eq('ativo',true).limit(1);\n    if(eProf)throw eProf;";
  if(!fn.includes(mark))throw new Error('Ponto para plano não encontrado');
  fn=fn.replace(mark,mark+"\n    const situacaoPlano=await obterSituacaoPlano(lojaId);\n    const planoOk=Boolean(situacaoPlano?.ativo&&!['trial','legado'].includes(String(situacaoPlano?.plano?.codigo||'')));" );
}

s=s.slice(0,a)+fn+s.slice(b);
fs.writeFileSync(p,s);
cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});

const out=fs.readFileSync(p,'utf8').slice(a,b+2500);
if(!out.includes("concluida:prompt.length>0"))throw new Error('Validação do Prompt não aplicada');
if(!out.includes("titulo:'Configure sua equipe'"))throw new Error('Etapa equipe não aplicada');
if(out.indexOf("id:'plano'")>out.indexOf("id:'operacao'"))throw new Error('Plano ainda está depois do WhatsApp');
console.log('[onboarding-coherence] PASS acesso unificado, prompt salvo e ordem coerente');