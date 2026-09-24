const fs=require('node:fs');
const auth=fs.readFileSync('public/js/auth.js','utf8');
const page=fs.readFileSync('public/gerenciador-contas.html','utf8');
const checks=[
  ['auth expõe obterSessao',/obterSessao/],
  ['auth expõe fazerLogout',/fazerLogout/],
  ['página usa endpoint admin GV',/\/api\/gv\/admin\/contas/],
  ['página envia Authorization',/Authorization/],
  ['página está no menu admin',/Gerenciador de Vendas/]
];
for(const [name,re] of checks){
  const src=name.startsWith('auth ')?auth:page;
  if(!re.test(src)) throw new Error('[gv-admin-static] FAIL '+name);
}
const pos=auth.indexOf('obterSessao');
console.log('[gv-admin-static] PASS contrato básico da sessão e tela');
console.log('[gv-admin-static] auth-context '+auth.slice(Math.max(0,pos-180),pos+700).replace(/\s+/g,' '));
