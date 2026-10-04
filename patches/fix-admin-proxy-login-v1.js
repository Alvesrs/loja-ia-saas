const fs=require('node:fs'),cp=require('node:child_process');
fs.writeFileSync('public/js/config.js',`const saintsProxyRoot='/functions/v1/saintsai-proxy';
const saintsApiSuffix=['','api'].join('/');
const API_BASE=window.location.pathname.startsWith(saintsProxyRoot+'/')?saintsProxyRoot+saintsApiSuffix:saintsApiSuffix;
`);
let guard=fs.readFileSync('public/js/guard.js','utf8').replace("const sessaoBruta = localStorage.getItem('lojaia_sessao');","const sessaoBruta = sessionStorage.getItem('lojaia_sessao') || localStorage.getItem('lojaia_sessao');");fs.writeFileSync('public/js/guard.js',guard);
let app=fs.readFileSync('src/app.js','utf8').replace("app.use('/painel', require('express').static(__saintsaiPublicDir, {","app.use('/painel',(req,res,next)=>{if(req.path==='/js/config.js'||req.path==='/js/guard.js')res.set('Cache-Control','no-store, no-cache, must-revalidate');next();});\napp.use('/painel', require('express').static(__saintsaiPublicDir, {");fs.writeFileSync('src/app.js',app);
fs.writeFileSync('public/admin-versao.json',JSON.stringify({versao:'2026.10.04.7',novidades:['Login no APK corrigido','Cadastro preserva sessão temporária']})+'\n');
for(const p of ['public/login.html','public/admin-cliente-cadastro.html']){let h=fs.readFileSync(p,'utf8').replace('src="js/config.js"','src="js/config.js?v=2026.10.04.7"').replace('src="js/guard.js"','src="js/guard.js?v=2026.10.04.7"');fs.writeFileSync(p,h);}
for(const p of ['public/js/config.js','public/js/guard.js','src/app.js'])cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});console.log('[fix-admin-proxy-login-v1] API do proxy e sessão temporária corrigidas.');
