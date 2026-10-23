import { deflateSync } from 'node:zlib';

const theme = '#0e0c15';
const manifest = JSON.stringify({
  id: '/',
  name: 'Órbita — Agentes de IA',
  short_name: 'Órbita',
  description: 'Gerencie seus agentes de IA, atendimento e agendamentos.',
  lang: 'pt-BR',
  start_url: '/launch.html',
  scope: '/',
  display: 'standalone',
  background_color: theme,
  theme_color: theme,
  icons: [192, 512].map(n => ({src: `/app-icon-${n}.png`, sizes: `${n}x${n}`, type: 'image/png', purpose: 'any maskable'})),
});
const installTags = '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="'+theme+'"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><link rel="apple-touch-icon" href="/app-icon-192.png"><script src="/app-install.js" defer></script>';
export function addInstallMetadata(html) {
  if (typeof html !== 'string' || html.includes('href="/manifest.webmanifest"')) return html;
  if (/<\/head\s*>/i.test(html)) return html.replace(/<\/head\s*>/i, installTags + '</head>');
  if (/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, m => m + installTags);
  return html.replace(/<html(?:\s[^>]*)?>/i, m => m + '<head>' + installTags + '</head>');
}

const installJs = "(() => {\n  const button = () => document.getElementById('install-orbita');\n  const status = text => {const el=document.getElementById('install-status');if(el)el.textContent=text;};\n  let deferred=null;\n  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;\n  const installed=()=>{deferred=null;const btn=button();if(btn){btn.hidden=true;}status('Órbita instalada. Abra pelo ícone na tela inicial e faça login para acessar sua conta.');};\n  if('serviceWorker' in navigator)navigator.serviceWorker.register('/service-worker.js',{scope:'/'}).catch(()=>status('Não foi possível preparar a instalação. Confira sua conexão e recarregue esta página.'));\n  if(standalone())installed();\n  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;const btn=button();if(btn)btn.hidden=false;status('Tudo pronto. Toque em Instalar app para confirmar a instalação no navegador.');});\n  document.addEventListener('click',async event=>{\n    const btn=event.target.closest&&event.target.closest('#install-orbita');if(!btn)return;\n    if(!deferred){document.getElementById('install-help')?.removeAttribute('hidden');status('Se a janela de instalação não aparecer, use o menu do navegador conforme as instruções abaixo. Não é necessário fazer login.');return;}\n    const prompt=deferred;deferred=null;btn.disabled=true;\n    try{await prompt.prompt();const choice=await prompt.userChoice;status(choice.outcome==='accepted'?'Confirme a conclusão da instalação no navegador. Depois, abra a Órbita pelo ícone.':'A instalação foi cancelada. Você pode instalar pelo menu do navegador quando quiser.');}\n    catch{status('Use o menu do navegador para instalar, seguindo as instruções abaixo.');}\n    finally{btn.disabled=false;}\n  });\n  window.addEventListener('appinstalled',installed);\n})();";
const workerJs = "const CACHE='orbita-shell-v2';\nself.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/offline.html','/launch.html','/launch.js','/app-icon-192.png'])).then(()=>self.skipWaiting())));\nself.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('orbita-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));\nself.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const u=new URL(event.request.url);if(u.origin!==self.location.origin)return;if(['/launch.js','/app-icon-192.png'].includes(u.pathname)){event.respondWith(caches.match(u.pathname).then(r=>r||fetch(event.request)));return;}if(event.request.mode!=='navigate'||u.pathname.startsWith('/auth/'))return;if(u.pathname==='/'||u.pathname==='/launch.html'){event.respondWith(caches.match('/launch.html').then(r=>r||fetch(event.request)));return;}event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));});";
const offlineHtml = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="'+theme+'"><title>Órbita · Sem conexão</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#0e0c15;color:#f1edf9;font:16px system-ui,sans-serif;padding:24px;text-align:center}main{max-width:320px}h1{font-size:24px}p{color:#a99dbd;line-height:1.6}button{background:#8460ed;border:0;border-radius:12px;color:white;font:600 16px system-ui;padding:14px 24px}</style></head><body><main><img src="/app-icon-192.png" width="76" height="76" alt="Órbita"><h1>Sem conexão com a internet</h1><p>Conecte seu celular à internet para acessar os dados do Órbita. Seus dados continuam protegidos no servidor.</p><button onclick="location.reload()">Tentar novamente</button></main></body></html>';
const crcTable = new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);crcTable[n]=c>>>0;}
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type,'ascii');const size=Buffer.alloc(4),check=Buffer.alloc(4);size.writeUInt32BE(data.length);check.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([size,t,data,check]);}
function iconPng(size){
  const scan = Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++){
    const row=y*(size*4+1);scan[row]=0;
    for(let x=0;x<size;x++){
      const px=(x+.5)/size-.5,py=(y+.5)/size-.5,r=Math.hypot(px,py),o=row+1+x*4;
      const gl=Math.max(0,1-r*1.4),base=[Math.round(19+21*gl),Math.round(14+13*gl),Math.round(36+45*gl)];
      const ca=Math.cos(.57),sa=Math.sin(.57);
      const ux=px*ca+py*sa,uy=-px*sa+py*ca;
      const vx=px*ca-py*sa,vy=px*sa+py*ca;
      const d1=Math.abs(Math.hypot(ux/.285,uy/.150)-1),d2=Math.abs(Math.hypot(vx/.285,vy/.150)-1);
      const ring=Math.max(0,Math.min(1,(.065-Math.min(d1,d2))*65));
      const core=Math.max(0,Math.min(1,(.063-r)*size*.30));
      const spark=Math.max(0,Math.min(1,(.027-Math.hypot(px-.225,py+.175))*size*.35));
      let col=base.map((v,i)=>Math.round(v*(1-ring)+[177,143,255][i]*ring));
      col=col.map((v,i)=>Math.round(v*(1-core)+[248,245,255][i]*core));
      col=col.map((v,i)=>Math.round(v*(1-spark)+[244,217,255][i]*spark));
      scan[o]=col[0];scan[o+1]=col[1];scan[o+2]=col[2];scan[o+3]=255;
    }
  }
  const hdr=Buffer.alloc(13);hdr.writeUInt32BE(size,0);hdr.writeUInt32BE(size,4);hdr[8]=8;hdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',deflateSync(scan,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
const pngs = new Map();
const headers = {'X-Content-Type-Options':'nosniff', 'Cache-Control':'public, max-age=3600'};
export function installAsset(path) {
  if(path==='/launch.html')return new Response("<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"theme-color\" content=\"#080e16\"><title>Abrindo Órbita</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:radial-gradient(ellipse at 30% 30%,#183a49,#080e16 70%);color:#edf7f5;font:16px/1.6 system-ui;text-align:center;padding:24px;box-sizing:border-box}main{max-width:320px}img{border-radius:24px}h1{font-weight:500;letter-spacing:-1px;font-size:32px}p{color:#b1c8cd}.ring{height:24px;width:24px;border:2px solid #46636a;border-top-color:#d0efea;border-radius:50%;margin:30px auto;animation:spin 1s linear infinite}button{background:#d4eee8;color:#173d40;border:0;border-radius:12px;padding:14px 24px;font:600 16px system-ui;cursor:pointer}[hidden]{display:none!important}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.ring{animation:none}}</style><script src=\"/launch.js\" defer></script></head><body><main><img src=\"/app-icon-192.png\" width=\"80\" height=\"80\" alt=\"Órbita\"><h1>Vamos entrar em órbita.</h1><div class=\"ring\" id=\"opening\" aria-hidden=\"true\"></div><p id=\"launch-status\" role=\"status\">Preparando seu espaço…</p><button id=\"launch-retry\" hidden>Tentar novamente</button><noscript>Ative o JavaScript para abrir o aplicativo.</noscript></main></body></html>",{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  if(path==='/launch.js')return new Response("(()=>{let busy=false;const status=document.getElementById('launch-status'),button=document.getElementById('launch-retry'),ring=document.getElementById('opening');async function open(){if(busy)return;busy=true;button.hidden=true;ring.hidden=false;const end=Date.now()+90000;while(Date.now()<end){try{const r=await fetch('/auth/session-status',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000)});if(r.ok&&(r.headers.get('content-type')||'').includes('application/json')){const data=await r.json();if(typeof data.signedIn==='boolean'){location.replace(data.signedIn?'/app':'/login');return;}}}catch{}status.textContent=navigator.onLine?'Preparando a conexão. A primeira abertura pode levar alguns instantes.':'Conecte-se à internet para continuar.';await new Promise(resolve=>setTimeout(resolve,1200));}busy=false;ring.hidden=true;status.textContent='A conexão demorou mais que o esperado. Tente novamente.';button.hidden=false;}button.onclick=open;open();})();",{headers:{...headers,'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-cache'}});
  if(path === '/instalar' || path === '/install') return new Response(addInstallMetadata("<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Instalar Órbita</title><style>*{box-sizing:border-box}body{margin:0;min-height:100dvh;background:#0e0c15;color:#f1edf9;font:16px/1.65 system-ui,sans-serif;display:grid;place-items:center;padding:28px}main{width:100%;max-width:440px}img{border-radius:20px}h1{font-size:36px;line-height:1.15;letter-spacing:-1px}p,li{color:#b9afc8}button,a{font:600 16px system-ui;border-radius:12px;padding:16px 20px}button{width:100%;border:0;background:#a886ff;color:#1b102f;cursor:pointer}button:disabled{opacity:.65}a{display:block;text-align:center;color:#d1bcff;border:1px solid #4a3c60;text-decoration:none;margin-top:12px}small{display:block;color:#a99dbd;margin-top:24px}ol{padding-left:20px}li+li{margin-top:12px}section{margin-top:28px;border-top:1px solid #3b3049;padding-top:16px}h2{font-size:19px}button:focus-visible,a:focus-visible{outline:2px solid white;outline-offset:4px}[hidden]{display:none!important}</style></head><body><main><img src=\"/app-icon-192.png\" width=\"80\" height=\"80\" alt=\"Órbita\"><h1>A Órbita no seu celular.</h1><p>Instale primeiro. Entre na sua conta depois, ao abrir o aplicativo.</p><button id=\"install-orbita\" type=\"button\">Instalar app</button><p id=\"install-status\" role=\"status\" aria-live=\"polite\">Não precisa de login para instalar. A opção de instalação depende do navegador.</p><section id=\"install-help\"><h2>Se não aparecer a janela de instalação</h2><ol><li><strong>Android:</strong> abra esta página no Chrome. Toque em ⋮ → Instalar aplicativo ou Adicionar à tela inicial.</li><li><strong>iPhone:</strong> abra no Safari. Toque em Compartilhar → Adicionar à Tela de Início.</li><li>Depois de instalar, abra pelo ícone da Órbita e faça login.</li></ol><p>Está dentro do Instagram, WhatsApp ou ChatGPT? Abra este link no navegador externo para instalar.</p></section><a href=\"/\">Já instalei · abrir app</a><small>Instalação pelo navegador, sem arquivo APK. A internet é necessária para operar sua conta.</small></main></body></html>"),{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  if (path === '/manifest.webmanifest') return new Response(manifest,{headers:{...headers,'Content-Type':'application/manifest+json; charset=utf-8'}});
  if(path === '/app-install.js') return new Response(installJs,{headers:{...headers,'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-cache'}});
  if(path === '/service-worker.js') return new Response(workerJs,{headers:{...headers,'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-cache','Service-Worker-Allowed':'/'}});
  if(path === '/offline.html') return new Response(offlineHtml,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'}});
  const m=/^\/app-icon-(192|512)\.png$/.exec(path);
  if(m){const size=Number(m[1]);if(!pngs.has(size))pngs.set(size,iconPng(size));return new Response(pngs.get(size),{headers:{...headers,'Content-Type':'image/png'}});}
  return null;
}
