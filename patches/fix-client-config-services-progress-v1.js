const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

const controller='src/controllers/clienteHub.controller.js';
let c=read(controller);
const a=c.indexOf('async function onboardingCliente(req,res){');
const b=c.indexOf('\nasync function ',a+20);
if(a<0||b<0)throw new Error('onboardingCliente não encontrado');
let fn=c.slice(a,b);

// Correção definitiva: garante a variável prompt antes das etapas.
if(!/const\s+prompt\s*=/.test(fn)){
  const anchor='    const etapas=[';
  if(!fn.includes(anchor))throw new Error('Etapas do onboarding não encontradas');
  const promptBlock=`    const prompt=String(lojaDados?.prompt_mestre||loja?.prompt_mestre||'')
      .replace(/\\[SAINTSAI_CONFIG_CLIENTE\\][\\s\\S]*?\\[\\/SAINTSAI_CONFIG_CLIENTE\\]/g,'')
      .replace(/\\[SAINTSAI_DADOS_NEGOCIO\\][\\s\\S]*?\\[\\/SAINTSAI_DADOS_NEGOCIO\\]/g,'')
      .trim();

`;
  fn=fn.replace(anchor,promptBlock+anchor);
}
c=c.slice(0,a)+fn+c.slice(b);
write(controller,c);

// A tela de configuração não pode esconder serviços se somente o progresso falhar.
const page='public/cliente-configuracao.html';
let h=read(page);
const old=`  [resumo,onboarding]=await Promise.all([apiFetch('/lojas/'+loja.id+'/cliente-hub'),apiFetch('/lojas/'+loja.id+'/cliente-hub/onboarding')]);
  $('company').textContent=resumo.loja?.nome||loja.nome||'Sua empresa';renderTabs();await renderEtapa();`;
const neu=`  resumo=await apiFetch('/lojas/'+loja.id+'/cliente-hub');
  try{onboarding=await apiFetch('/lojas/'+loja.id+'/cliente-hub/onboarding')}catch(e){
    console.warn('[onboarding]',e);
    onboarding={percentual:0,concluidas:0,total:0,etapas:[],proxima:null,pronto:false};
  }
  $('company').textContent=resumo.loja?.nome||loja.nome||'Sua empresa';renderTabs();await renderEtapa();`;
if(!h.includes(old))throw new Error('Carregamento conjunto da configuração não encontrado');
h=h.replace(old,neu);

// Recarregar progresso também não deve destruir a tela se houver falha transitória.
h=h.replace(
  "async function recarregarProgresso(){onboarding=await apiFetch('/lojas/'+loja.id+'/cliente-hub/onboarding');renderTabs()}",
  "async function recarregarProgresso(){try{onboarding=await apiFetch('/lojas/'+loja.id+'/cliente-hub/onboarding')}catch(e){console.warn('[onboarding]',e)}renderTabs()}"
);
write(page,h);

cp.execFileSync(process.execPath,['--check',controller],{stdio:'inherit'});

const out=read(controller).slice(a,b+1200);
if(!/const\s+prompt\s*=/.test(out))throw new Error('prompt ainda ausente no onboarding');
if(!read(page).includes("resumo=await apiFetch('/lojas/'+loja.id+'/cliente-hub');"))throw new Error('fallback da configuração não aplicado');

console.log('[cliente-config-fix] PASS prompt definido e serviços independentes do onboarding');
