'use strict';const fs=require('node:fs');const version='2026.10.14.2';
for(const ext of ['css','js'])fs.copyFileSync('patches/assets/saintsai-interface-v7.'+ext,'public/'+ext+'/saintsai-interface-v7.'+ext);
for(const file of fs.readdirSync('public').filter(n=>/^(cliente|admin).*\.html$/.test(n)||n==='login.html')){
 let s=fs.readFileSync('public/'+file,'utf8');
 if(!s.includes('css/saintsai-interface-v7.css'))s=s.replace('</head>',`<link rel="stylesheet" href="css/saintsai-interface-v7.css?v=${version}"></head>`);
 if(!s.includes('js/saintsai-interface-v7.js'))s=s.replace('</body>',`<script src="js/saintsai-interface-v7.js?v=${version}"></script></body>`);
 fs.writeFileSync('public/'+file,s);
}
