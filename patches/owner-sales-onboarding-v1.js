const fs=require('node:fs');
function edit(file,fn){fs.writeFileSync(file,fn(fs.readFileSync(file,'utf8')));}
function replace(s,a,b){if(!s.includes(a))throw Error('Missing patch anchor: '+a.slice(0,60));return s.replace(a,b);}
for(const [name,dest] of [['first-access.controller.js','src/controllers/firstAccess.controller.js'],['owner-sales-onboarding.service.js','src/services/ownerSalesOnboarding.service.js'],['cliente-primeiro-acesso.html','public/cliente-primeiro-acesso.html'],['first-access.js','public/js/first-access.js']])fs.copyFileSync('patches/assets/'+name,dest);
edit('src/middleware/auth.js',s=>s.includes('const trusted=req.usuario.app_metadata||{};')?s:replace(s,'req.usuario = data.user;',`req.usuario = data.user;
    const trusted=req.usuario.app_metadata||{};
    if(trusted.saintsai_credentials_after){let issued=0;try{issued=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).iat||0;}catch(_){}if(issued<Number(trusted.saintsai_credentials_after))return res.status(401).json({erro:'Entre com seu novo e-mail e senha.'});}
    const accessPath=(req.originalUrl||'').split('?')[0];
    if(trusted.saintsai_first_access===true&&!['/api/auth/primeiro-acesso','/api/auth/primeiro-acesso/status'].includes(accessPath))return res.status(403).json({code:'FIRST_ACCESS_REQUIRED',erro:'Troque seu e-mail e sua senha temporários para continuar.'});`));
edit('src/controllers/admin.controller.js',s=>s.includes('saintsai_first_access: !emailEhTeste')?s:replace(s,'saintsai_managed: true, saintsai_test: emailEhTeste','saintsai_managed: true, saintsai_test: emailEhTeste, saintsai_first_access: !emailEhTeste'));
edit('src/routes/auth.routes.js',s=>s.includes("router.get('/primeiro-acesso/status'")?s:replace(s,'module.exports = router;',`const first=require('../controllers/firstAccess.controller');
const {exigirLogin}=require('../middleware/auth');
router.get('/primeiro-acesso/status',exigirLogin,first.status);
router.post('/primeiro-acesso',limitarLogin,exigirLogin,first.concluir);
module.exports = router;`));
edit('src/routes/admin.routes.js',s=>s.includes("router.get('/prospeccao/vendas'")?s:replace(s,"router.get('/notificacoes/dispositivos'",`router.get('/prospeccao/vendas',exigirAdmin,async(req,res)=>{res.set('Cache-Control','no-store');try{res.json(await require('../services/ownerSalesOnboarding.service').list(req.usuario,req.query.lojaId));}catch(e){res.status(e.status||503).json({erro:e.status?e.message:'Não foi possível carregar as contratações.'});}});
router.get('/notificacoes/dispositivos'`));
edit('src/services/salesSeller.service.js',s=>s.includes('const sellerBase=module.exports.responder;')?s:s+`
const sellerBase=module.exports.responder;
module.exports.responder=async args=>{const flow=require('./ownerSalesOnboarding.service');const handled=await flow.handle(args);if(handled.handled)return handled.response;return flow.after(args,await sellerBase(args));};
`);
edit('src/services/ownerFirstMessage.service.js',s=>s.includes("require('./ownerSalesOnboarding.service').remember")?s:replace(s,'module.exports={iniciar,promptDaLoja};',`module.exports={iniciar:async(usuario,body)=>{const result=await iniciar(usuario,body);try{await require('./ownerSalesOnboarding.service').remember(usuario,body);}catch(_){/* Context is optional; never repeat an already-sent intro. */}return result;},promptDaLoja};`));
edit('public/js/guard.js',s=>s.includes('saintsai_first_access===true')?s:replace(s,'if (!sessao || !sessao.token) {',`if(sessao?.usuario?.app_metadata?.saintsai_first_access===true){window.location.replace('cliente-primeiro-acesso.html');return;}
    if (!sessao || !sessao.token) {`));
edit('public/js/api.js',s=>s.includes("body?.code==='FIRST_ACCESS_REQUIRED'")?s:replace(s,'if(!res.ok)throw Error',`if(res.status===403&&body?.code==='FIRST_ACCESS_REQUIRED'){window.location.replace(caminhoRelativo('cliente-primeiro-acesso.html'));throw Error(body.erro);}if(!res.ok)throw Error`));
for(const file of ['public/login.html','public/cliente-login.html'])edit(file,s=>s.replaceAll('window.location.href = destinoAposLogin;',`window.location.href = resposta.usuario?.app_metadata?.saintsai_first_access===true?'cliente-primeiro-acesso.html':destinoAposLogin;`).replaceAll('window.location.replace(destinoAposLogin);',`window.location.replace(obterUsuario()?.app_metadata?.saintsai_first_access===true?'cliente-primeiro-acesso.html':destinoAposLogin);`).replaceAll("window.location.replace('cliente-central.html');",`window.location.replace(obterUsuario()?.app_metadata?.saintsai_first_access===true?'cliente-primeiro-acesso.html':'cliente-central.html');`));
edit('public/js/owner-prospecting.js',s=>s.includes('Contratações do vendedor')?s:s.replace('telefone:phone}',`telefone:phone,prospect:{nome:a.closest('article')?.querySelector('.name')?.textContent||'',categoria:document.getElementById('categoria')?.value||'',cidade:document.getElementById('cidade')?.value||''}}`)+fs.readFileSync('patches/assets/owner-sales-pipeline.js','utf8'));
for(const kind of ['cliente','admin']){const f='public/'+kind+'-versao.json';const v=JSON.parse(fs.readFileSync(f));v.versao='2026.10.08.1';v.novidades=['Primeiro acesso com troca obrigatória de credenciais e vendedor conectado à prospecção'];fs.writeFileSync(f,JSON.stringify(v,null,2));}
console.log('Primeiro acesso e vendedor de contratações instalados.');
