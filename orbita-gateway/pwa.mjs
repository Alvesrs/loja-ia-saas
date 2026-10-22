import { deflateSync } from 'node:zlib';

const theme = '#0e0c15';
const manifest = JSON.stringify({
  id: '/',
  name: 'Órbita — Agentes de IA',
  short_name: 'Órbita',
  description: 'Gerencie seus agentes de IA, atendimento e agendamentos.',
  lang: 'pt-BR',
  start_url: '/',
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

const installJs = `(() => {
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js', {scope:'/'}).catch(() => {}));
  let deferred = null;
  const button = () => document.getElementById('install-orbita');
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); deferred = event;
    const btn = button(); if (btn) btn.hidden = false;
  });
  document.addEventListener('click', async event => {
    const btn = event.target.closest('#install-orbita');
    if (!btn || !deferred) return;
    const prompt = deferred; deferred = null; btn.hidden = true;
    await prompt.prompt().catch(() => {});
  });
  window.addEventListener('appinstalled', () => {deferred = null; const btn = button(); if(btn) btn.hidden = true;});
})();`;
const workerJs = `const CACHE = 'orbita-shell-v1';
self.addEventListener('install', event => {event.waitUntil(caches.open(CACHE).then(c => c.add('/offline.html')).then(() => self.skipWaiting()));});
self.addEventListener('activate', event => {event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))), self.clients.claim()]));});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/auth/')) return;
  event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
});`;
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
  if (path === '/manifest.webmanifest') return new Response(manifest,{headers:{...headers,'Content-Type':'application/manifest+json; charset=utf-8'}});
  if(path === '/app-install.js') return new Response(installJs,{headers:{...headers,'Content-Type':'application/javascript; charset=utf-8'}});
  if(path === '/service-worker.js') return new Response(workerJs,{headers:{...headers,'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-cache','Service-Worker-Allowed':'/'}});
  if(path === '/offline.html') return new Response(offlineHtml,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'}});
  const m=/^\/app-icon-(192|512)\.png$/.exec(path);
  if(m){const size=Number(m[1]);if(!pngs.has(size))pngs.set(size,iconPng(size));return new Response(pngs.get(size),{headers:{...headers,'Content-Type':'image/png'}});}
  return null;
}
