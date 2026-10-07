const fs=require('node:fs');
for(const [name,dir] of [['saintsai-remake.css','css'],['saintsai-remake.js','js']])fs.copyFileSync('patches/assets/'+name,'public/'+dir+'/'+name);
const version='2026.10.07.19';
for(const file of fs.readdirSync('public').filter(n=>/^(cliente|admin).*\.html$/.test(n))){let s=fs.readFileSync('public/'+file,'utf8');if(!s.includes('css/saintsai-remake.css'))s=s.replace('</head>','<link rel="stylesheet" href="css/saintsai-remake.css?v='+version+'"></head>');if(!s.includes('js/saintsai-remake.js'))s=s.replace('</body>','<script src="js/saintsai-remake.js?v='+version+'"></script></body>');fs.writeFileSync('public/'+file,s);}
for(const kind of ['admin','cliente']){const p='public/'+kind+'-versao.json';const v=JSON.parse(fs.readFileSync(p));v.versao=version;v.novidades=['Remake SaintsAI: nova navegação, nova visão geral e identidade roxa'];fs.writeFileSync(p,JSON.stringify(v,null,2));}
console.log('SaintsAI remake aplicado nos dois apps.');
