// Versioned assets also refresh inside the existing Android WebViews.
const fs=require('node:fs');
const version='2026.10.10.1';
for(const ext of ['css','js'])fs.copyFileSync(`patches/assets/saintsai-neon-v6.${ext}`,`public/${ext}/saintsai-neon-v6.${ext}`);
let count=0;
for(const file of fs.readdirSync('public').filter(n=>/^(cliente|admin).*\.html$/.test(n)||n==='login.html')){
 let html=fs.readFileSync('public/'+file,'utf8');
 if(!html.includes('css/saintsai-neon-v6.css'))html=html.replace('</head>',`<link rel="stylesheet" href="css/saintsai-neon-v6.css?v=${version}"></head>`);
 if(!html.includes('js/saintsai-neon-v6.js'))html=html.replace('</body>',`<script src="js/saintsai-neon-v6.js?v=${version}"></script></body>`);
 fs.writeFileSync('public/'+file,html);count++;
}
for(const role of ['cliente','admin']){const path=`public/${role}-versao.json`;const release=JSON.parse(fs.readFileSync(path));release.versao=version;release.publicado_em='2026-10-10';release.novidades=['Nova interface SaintsAI: painéis redesenhados, cartões arredondados, roxo mais vivo e navegação refinada.'];fs.writeFileSync(path,JSON.stringify(release,null,2));}
console.log(`SaintsAI neon aplicado a ${count} telas.`);
