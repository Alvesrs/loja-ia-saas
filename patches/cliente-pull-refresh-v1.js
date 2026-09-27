const fs=require('node:fs');
const path=require('node:path');

const jsPath='public/js/cliente-pull-refresh-v1.js';
const js=`
(function(){
  if(window.__saintsPullRefreshV1)return;
  window.__saintsPullRefreshV1=true;

  var startY=0,startX=0,tracking=false,armed=false;
  var indicator=document.createElement('div');
  indicator.id='saints-pull-refresh';
  indicator.textContent='Puxe para atualizar';
  indicator.style.cssText=[
    'position:fixed','left:50%','top:calc(env(safe-area-inset-top) + 10px)',
    'transform:translate(-50%,-70px)','z-index:99999',
    'padding:9px 14px','border-radius:999px',
    'background:rgba(24,18,35,.96)','border:1px solid rgba(168,85,247,.35)',
    'color:#efe7ff','font:700 12px system-ui,sans-serif',
    'box-shadow:0 8px 28px rgba(0,0,0,.35)',
    'transition:transform .16s ease,opacity .16s ease','opacity:0',
    'pointer-events:none'
  ].join(';');
  document.addEventListener('DOMContentLoaded',function(){
    if(!indicator.isConnected)document.body.appendChild(indicator);
  });

  function atTop(){
    var el=document.scrollingElement||document.documentElement;
    return (el.scrollTop||window.scrollY||0)<=1;
  }
  function interactive(t){
    return !!(t&&t.closest&&t.closest('input,textarea,select,button,[contenteditable="true"]'));
  }
  function reset(){
    tracking=false;armed=false;
    indicator.style.transform='translate(-50%,-70px)';
    indicator.style.opacity='0';
    indicator.textContent='Puxe para atualizar';
  }

  window.addEventListener('touchstart',function(e){
    if(e.touches.length!==1||!atTop()||interactive(e.target))return;
    var t=e.touches[0];
    startY=t.clientY;startX=t.clientX;tracking=true;armed=false;
  },{passive:true});

  window.addEventListener('touchmove',function(e){
    if(!tracking||e.touches.length!==1)return;
    var t=e.touches[0],dy=t.clientY-startY,dx=Math.abs(t.clientX-startX);
    if(dy<0||dx>Math.max(28,dy*.65)){reset();return;}
    if(dy>12){
      var shown=Math.min(1,(dy-12)/70);
      indicator.style.opacity=String(Math.min(1,shown+.15));
      indicator.style.transform='translate(-50%,'+(Math.min(18,-70+dy*.72))+'px)';
      armed=dy>=92;
      indicator.textContent=armed?'Solte para atualizar':'Puxe para atualizar';
    }
  },{passive:true});

  window.addEventListener('touchend',function(){
    if(!tracking)return;
    if(armed){
      tracking=false;
      indicator.textContent='Atualizando…';
      indicator.style.opacity='1';
      indicator.style.transform='translate(-50%,18px)';
      setTimeout(function(){window.location.reload();},80);
    }else reset();
  },{passive:true});

  window.addEventListener('touchcancel',reset,{passive:true});
})();
`;
fs.mkdirSync(path.dirname(jsPath),{recursive:true});
fs.writeFileSync(jsPath,js);

const dir='public';
for(const name of fs.readdirSync(dir)){
  if(!/^cliente-.*\.html$/i.test(name))continue;
  const p=path.join(dir,name);
  let h=fs.readFileSync(p,'utf8');
  if(h.includes('cliente-pull-refresh-v1.js'))continue;
  const tag='<script src="js/cliente-pull-refresh-v1.js"></script>';
  if(h.includes('</body>'))h=h.replace('</body>',tag+'</body>');
  else h+=tag;
  fs.writeFileSync(p,h);
}
console.log('Pull-to-refresh ativado nas paginas do cliente.');
