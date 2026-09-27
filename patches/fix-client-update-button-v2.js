const fs=require('node:fs');
const p='public/cliente-central.html';
let h=fs.readFileSync(p,'utf8');

const css=`
/* SAINTSAI_UPDATE_BUTTON_V2 */
#saintsai-update-fixed{
  position:fixed;right:16px;bottom:calc(82px + env(safe-area-inset-bottom));
  z-index:9999;border:1px solid rgba(168,85,247,.48);
  background:linear-gradient(135deg,#6d28d9,#9333ea);color:#fff;
  border-radius:16px;padding:12px 14px;font:800 12px/1 system-ui,sans-serif;
  box-shadow:0 12px 32px rgba(91,33,182,.42);display:none;align-items:center;gap:8px
}
#saintsai-update-fixed.show{display:flex}
#saintsai-update-fixed small{opacity:.82;font-size:9px;font-weight:700}
@media(min-width:800px){#saintsai-update-fixed{right:24px;bottom:24px}}
`;
if(!h.includes('SAINTSAI_UPDATE_BUTTON_V2'))h=h.replace('</style>',css+'\n</style>');

if(!h.includes('id="saintsai-update-fixed"')){
  h=h.replace('</body>',`
<button id="saintsai-update-fixed" type="button" aria-label="Atualizar SaintsAI Cliente">
  <span>↻</span><span>Atualizar app<small id="saintsai-update-version"></small></span>
</button>
<script>
(function(){
  function initUpdate(){
    try{
      var btn=document.getElementById('saintsai-update-fixed');
      var ver=document.getElementById('saintsai-update-version');
      if(!btn)return;
      var nativeOk=window.AndroidClient && typeof window.AndroidClient.installLatest==='function';
      if(!nativeOk){btn.classList.remove('show');return;}
      btn.classList.add('show');
      try{
        var atual=String(window.AndroidClient.getVersionName?.()||'');
        if(ver&&atual)ver.textContent=' · instalada '+atual;
      }catch(_){}
      btn.onclick=function(){
        try{window.AndroidClient.installLatest();}
        catch(e){alert('Não foi possível iniciar a atualização agora.');}
      };
    }catch(e){console.warn('[update-button]',e)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initUpdate);
  else initUpdate();
  setTimeout(initUpdate,900);
})();
</script>
</body>`);
}
fs.writeFileSync(p,h);
if(!h.includes('id="saintsai-update-fixed"'))throw new Error('Botão de atualização não foi aplicado');
console.log('[client-update-button-v2] PASS botão nativo fixo e persistente');
