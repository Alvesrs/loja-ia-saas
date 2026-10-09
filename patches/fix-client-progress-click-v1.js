const fs=require('node:fs');
const path='public/cliente-central.html';
let html=fs.readFileSync(path,'utf8');
const js=`(()=>{'use strict';
const destinos={ia:'ia',trabalho:'ia',servicos:'servicos',serviços:'servicos',produtos:'servicos',pagamentos:'pagamentos',agenda:'agenda',operacao:'operacao',operação:'operacao',whatsapp:'operacao'};
function ir(etapa){const id=destinos[String(etapa||'').toLowerCase()]||'ia';location.assign('cliente-configuracao.html?etapa='+encodeURIComponent(id));}
document.addEventListener('click',event=>{
 const target=event.target.closest('button,a,[data-onboard],.onboard-step');
 if(!target)return;
 const setup=target.closest('#setup-zone,#onboarding-real,.reference-onboard,.onboard,.sa-setup,.sa-progress');
 if(!setup)return;
 const label=(target.textContent||'').trim().toLowerCase();
 const id=target.dataset.onboard||target.closest('[data-onboard]')?.dataset.onboard||'';
 if(!id&&!/continuar|cadastre seu trabalho|configura|etapa|concluir/.test(label))return;
 event.preventDefault();event.stopImmediatePropagation();
 const nearby=target.closest('[data-onboard]')?.dataset.onboard||target.closest('.onboard-step')?.dataset.onboard||'';
 const text=(target.closest('.onboard-step,.onboard,.reference-onboard')?.textContent||label).toLowerCase();
 const fromText=/pagamento|pix/.test(text)?'pagamentos':/agenda|horário/.test(text)?'agenda':/whatsapp|conectar/.test(text)?'operacao':/serviço|produto|item/.test(text)?'servicos':'ia';
 ir(id||nearby||fromText);
},true);
})();`;
if(!html.includes('SAINTSAI_PROGRESS_CLICK_FIX_V1'))html=html.replace('</body>','<script id="SAINTSAI_PROGRESS_CLICK_FIX_V1">'+js+'</script></body>');
fs.writeFileSync(path,html);
const v='public/cliente-versao.json',o=JSON.parse(fs.readFileSync(v,'utf8'));o.versao='2026.10.09.7';o.novidades=['Botão Continuar do progresso abre a etapa correta de configuração'];fs.writeFileSync(v,JSON.stringify(o,null,2));
if(!html.includes('SAINTSAI_PROGRESS_CLICK_FIX_V1')||!html.includes('cliente-configuracao.html?etapa='))throw Error('Navegação do progresso ausente');
console.log('[progress-click] PASS navegação da configuração do cliente');
