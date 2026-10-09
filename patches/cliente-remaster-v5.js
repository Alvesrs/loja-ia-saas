const fs=require('node:fs');
const version='2026.10.09.1';
for(const [name,dir] of [['cliente-remaster-v5.css','css'],['cliente-remaster-v5.js','js']])fs.copyFileSync('patches/assets/'+name,'public/'+dir+'/'+name);
for(const file of fs.readdirSync('public').filter(n=>/^cliente.*\.html$/.test(n))){
 let html=fs.readFileSync('public/'+file,'utf8');
 if(!html.includes('css/cliente-remaster-v5.css'))html=html.replace('</head>',`<link rel="stylesheet" href="css/cliente-remaster-v5.css?v=${version}"></head>`);
 if(!html.includes('js/cliente-remaster-v5.js'))html=html.replace('</body>',`<script src="js/cliente-remaster-v5.js?v=${version}"></script></body>`);
 fs.writeFileSync('public/'+file,html);
}
const path='public/cliente-versao.json';const release=JSON.parse(fs.readFileSync(path));release.versao=version;release.publicado_em='2026-10-09';release.novidades=['Novo visual SaintsAI Cliente: roxo e preto, navegação focada em agenda e agente, formulários mais legíveis e cadastro em destaque.'];fs.writeFileSync(path,JSON.stringify(release,null,2));
console.log('Remaster v5 aplicado somente ao SaintsAI Cliente.');
