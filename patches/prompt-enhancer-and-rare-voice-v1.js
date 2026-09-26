const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

const appPath='src/app.js';
let app=read(appPath);
if(!app.includes("const promptEnhanceLlm = require('./services/llm.service');")){
  app=app.replace("const express = require('express');","const express = require('express');\nconst promptEnhanceLlm = require('./services/llm.service');\nconst { exigirLogin: exigirLoginPrompt } = require('./middleware/auth');");
}
if(!app.includes("app.post('/api/aprimorar-prompt'")){
  const anchor="app.use('/api/public/compra-saintsai', compraPublicaRoutes);";
  if(!app.includes(anchor)) throw new Error('Ponto de rota pública não encontrado');
  const rota=[
    "app.post('/api/aprimorar-prompt', exigirLoginPrompt, async (req,res)=>{",
    "  const original=String(req.body?.prompt||'').trim();",
    "  if(!original) return res.status(400).json({erro:'Digite o Prompt Mestre antes de aprimorar.'});",
    "  if(original.length>12000) return res.status(400).json({erro:'Prompt muito grande.'});",
    "  if(!promptEnhanceLlm.estaConfigurado()) return res.status(503).json({erro:'A IA de aprimoramento não está disponível agora.'});",
    "  const systemPrompt=[",
    "    'Você é um especialista em arquitetura de prompts para agentes comerciais no WhatsApp.',",
    "    'Reescreva o conteúdo fornecido como um Prompt Mestre extremamente claro, completo, organizado e operacional.',",
    "    'NÃO invente fatos, preços, horários, políticas, endereços, produtos ou condições que não estejam no texto original.',",
    "    'Quando uma informação importante estiver ausente, escreva NÃO INFORMADO na seção apropriada.',",
    "    'Preserve todos os fatos úteis e elimine ambiguidades, duplicações e contradições aparentes sem escolher fatos novos.',",
    "    'Organize em seções: IDENTIDADE DO NEGÓCIO, OBJETIVO DO ATENDIMENTO, TOM DE VOZ, HORÁRIOS, PRODUTOS/SERVIÇOS, PREÇOS, ESTOQUE/DISPONIBILIDADE, PAGAMENTOS, ENTREGA/RETIRADA, TROCAS/REGRAS, FLUXO DE ATENDIMENTO, QUANDO CHAMAR HUMANO, SITUAÇÕES ESPECIAIS, O QUE A IA NÃO DEVE FAZER e INFORMAÇÕES QUE AINDA FALTAM.',",
    "    'Use português do Brasil. Seja detalhado, mas sem frases decorativas ou repetitivas.',",
    "    'Retorne somente o Prompt Mestre aprimorado, sem comentários antes ou depois.'",
    "  ].join('\\n');",
    "  try{",
    "    const aprimorado=await promptEnhanceLlm.gerarResposta({systemPrompt,contexto:'Transforme exclusivamente as informações abaixo. Não use conhecimento externo para completar dados do negócio.',pergunta:original});",
    "    const texto=String(aprimorado||'').trim().slice(0,12000);",
    "    if(!texto) return res.status(502).json({erro:'A IA não retornou um prompt válido.'});",
    "    return res.json({prompt_aprimorado:texto});",
    "  }catch(e){console.error('[prompt-enhance] falha',e?.name||'erro');return res.status(502).json({erro:'Não foi possível aprimorar o prompt agora.'});}",
    "});"
  ].join('\n');
  app=app.replace(anchor,anchor+'\n'+rota);
}
write(appPath,app);

const adminPath='public/admin-cliente.html';
let h=read(adminPath);
if(!h.includes('cliente-aprimorar')){
  h=h.replace(
    '<textarea id="cliente-prompt" maxlength="12000" placeholder="Cole aqui as regras, personalidade, produtos, horários e orientações do atendimento."></textarea>',
    '<textarea id="cliente-prompt" maxlength="12000" placeholder="Cole aqui as regras, personalidade, produtos, horários e orientações do atendimento."></textarea><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="cliente-aprimorar" class="btn-secondary" type="button">✨ Aprimorar com IA</button><button id="cliente-restaurar" class="btn-secondary hidden" type="button">Restaurar original</button></div><small id="cliente-aprimorar-status" style="opacity:.72"></small>'
  );
  const hook="document.getElementById('cliente-salvar').addEventListener('click',async()=>{";
  const code=[
    "let promptOriginalAntesAprimorar=null;",
    "document.getElementById('cliente-aprimorar').addEventListener('click',async()=>{",
    " const campo=document.getElementById('cliente-prompt'),st=document.getElementById('cliente-aprimorar-status'),b=document.getElementById('cliente-aprimorar');",
    " const original=campo.value.trim(); if(!original){st.textContent='Digite o Prompt Mestre primeiro.';return;}",
    " b.disabled=true;st.textContent='Aprimorando com IA…';",
    " try{const x=await apiFetch('/aprimorar-prompt',{method:'POST',body:JSON.stringify({prompt:original})});if(!x.prompt_aprimorado)throw new Error('A IA não retornou uma versão aprimorada.');promptOriginalAntesAprimorar=campo.value;campo.value=x.prompt_aprimorado;document.getElementById('cliente-restaurar').classList.remove('hidden');st.textContent='Prévia pronta. Revise e salve para usar esta versão.';}catch(e){if(e instanceof SessaoExpiradaError)return fazerLogout();st.textContent=e.message||'Não foi possível aprimorar.';}finally{b.disabled=false;}",
    "});",
    "document.getElementById('cliente-restaurar').addEventListener('click',()=>{if(promptOriginalAntesAprimorar!==null){document.getElementById('cliente-prompt').value=promptOriginalAntesAprimorar;document.getElementById('cliente-aprimorar-status').textContent='Prompt original restaurado.';}});",
    hook
  ].join('\n');
  if(!h.includes(hook)) throw new Error('Hook admin prompt não encontrado');
  h=h.replace(hook,code);
}
write(adminPath,h);

const atendPath='public/js/atendente.js';
let js=read(atendPath);
if(!js.includes('saintsaiPromptEnhancerInit')){
js += [
"",
"(function saintsaiPromptEnhancerInit(){",
" function iniciar(){",
"  const campo=document.querySelector('textarea[id*=\\\"prompt\\\" i], textarea[name*=\\\"prompt\\\" i]');",
"  if(!campo||document.getElementById('saintsai-aprimorar-prompt'))return;",
"  const wrap=document.createElement('div');wrap.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:10px';",
"  const b=document.createElement('button');b.id='saintsai-aprimorar-prompt';b.type='button';b.className='btn-secondary';b.textContent='✨ Aprimorar com IA';",
"  const voltar=document.createElement('button');voltar.type='button';voltar.className='btn-secondary';voltar.textContent='Restaurar original';voltar.style.display='none';",
"  const st=document.createElement('div');st.style.cssText='font-size:13px;opacity:.75;width:100%';let original=null;",
"  b.onclick=async()=>{const atual=campo.value.trim();if(!atual){st.textContent='Digite o Prompt Mestre primeiro.';return;}b.disabled=true;st.textContent='Aprimorando com IA…';try{const x=await apiFetch('/aprimorar-prompt',{method:'POST',body:JSON.stringify({prompt:atual})});if(!x.prompt_aprimorado)throw new Error('A IA não retornou uma versão aprimorada.');original=campo.value;campo.value=x.prompt_aprimorado;campo.dispatchEvent(new Event('input',{bubbles:true}));voltar.style.display='inline-flex';st.textContent='Prévia pronta. Revise antes de salvar.';}catch(e){st.textContent=e.message||'Não foi possível aprimorar agora.';}finally{b.disabled=false;}};",
"  voltar.onclick=()=>{if(original!==null){campo.value=original;campo.dispatchEvent(new Event('input',{bubbles:true}));st.textContent='Prompt original restaurado.';}};",
"  wrap.append(b,voltar,st);campo.insertAdjacentElement('afterend',wrap);",
" }",
" if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(iniciar,200));else setTimeout(iniciar,200);",
"})();",
""
].join('\n');
}
write(atendPath,js);

const voicePath='src/services/salesVoice.service.js';
let v=read(voicePath);
const old="  if(!est||(!pedidoAudio&&!cooldownOk(est.ultimo_audio_em))) return {enviado:false,motivo:'cooldown'};";
const neu=[
  "  if(!est) return {enviado:false,motivo:'sem_conversa'};",
  "  if(!pedidoAudio && est.audio_divulgado===true) return {enviado:false,motivo:'voz_automatica_ja_usada'};",
  "  if(!pedidoAudio && !cooldownOk(est.ultimo_audio_em)) return {enviado:false,motivo:'cooldown'};"
].join('\n');
if(v.includes(old))v=v.replace(old,neu);
else if(!v.includes('voz_automatica_ja_usada')) throw new Error('Regra de voz não encontrada');
write(voicePath,v);

cp.execFileSync(process.execPath,['--check',appPath],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check',atendPath],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check',voicePath],{stdio:'inherit'});
console.log('Aprimorador de Prompt Mestre e voz automática rara aplicados.');