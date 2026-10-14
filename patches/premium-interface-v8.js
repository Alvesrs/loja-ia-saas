'use strict';
const fs=require('node:fs'),path=require('node:path');const source=path.join(__dirname,'assets/premium-v8'),version='2026.10.14.8';
fs.mkdirSync('public/fonts',{recursive:true});
for(const name of ['manrope-latin-wght-normal.woff2','sora-latin-wght-normal.woff2'])fs.copyFileSync(path.join(source,name),'public/fonts/'+name);
for(const ext of ['css','js'])fs.copyFileSync(path.join(source,'premium-v8.'+ext),'public/'+ext+'/premium-v8.'+ext);
for(const name of fs.readdirSync('public').filter(n=>/^(cliente-|admin-).*\.html$/.test(n))){const file='public/'+name;let html=fs.readFileSync(file,'utf8');if(!/<head\b/i.test(html))continue;
 html=html.replace(/<link[^>]*href=["']css\/premium-v8\.css[^"']*["'][^>]*>/gi,'').replace(/<script[^>]*src=["']js\/premium-v8\.js[^"']*["'][^>]*>\s*<\/script>/gi,'');
 html=html.replace('</head>',`<link rel="stylesheet" href="css/premium-v8.css?v=${version}"></head>`).replace('</body>',`<script src="js/premium-v8.js?v=${version}"></script></body>`);fs.writeFileSync(file,html);
}
for(const kind of ['cliente','admin']){const file='public/'+kind+'-versao.json';const old=JSON.parse(fs.readFileSync(file));fs.writeFileSync(file,JSON.stringify({...old,versao:version,publicado_em:'2026-10-14',novidades:['SaintsAI Business Studio: nova organização, tipografia e navegação','Busca de funções e atalhos favoritos por empresa','Modo foco e resumo do dia em CSV, sem dados de clientes']},null,2)+'\n');}
