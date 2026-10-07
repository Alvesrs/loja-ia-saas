const fs=require('node:fs');
let auth=fs.readFileSync('public/js/auth.js','utf8');
for(const action of ['refresh','logout'])auth=auth.replaceAll("API_BASE+'/auth/"+action+"'","API_BASE+['','auth','"+action+"'].join('/')");
fs.writeFileSync('public/js/auth.js',auth);
let api=fs.readFileSync('public/js/api.js','utf8');
api=api.replace('async function apiFetch(caminho,opcoes={}){','async function apiFetch(caminho,opcoes={}){const proxyPrefix=[\'\',\'functions\',\'v1\',\'saintsai-proxy\'].join(\'/\');if(caminho.startsWith(proxyPrefix+\'/\'))caminho=caminho.slice(proxyPrefix.length);');
fs.writeFileSync('public/js/api.js',api);
for(const name of fs.readdirSync('public').filter(x=>x.endsWith('.html'))){const p='public/'+name;let h=fs.readFileSync(p,'utf8');h=h.replace(/src="js\/(auth|api|config)\.js(?:\?[^\"]*)?"/g,'src="js/$1.js?v=2026.10.07.2"');fs.writeFileSync(p,h);}
const version=JSON.parse(fs.readFileSync('public/admin-versao.json','utf8'));version.versao='2026.10.07.2';version.novidades.unshift('Renovação de sessão corrigida na busca e no APK');fs.writeFileSync('public/admin-versao.json',JSON.stringify(version)+'\n');
let updater=fs.readFileSync('public/js/admin-atualizacao.js','utf8').replace(/Versão \d{4}\.\d{2}\.\d{2}\.\d+/g,'Versão 2026.10.07.2');fs.writeFileSync('public/js/admin-atualizacao.js',updater);
console.log('Sessão do proxy: caminhos de autenticação preservados.');
