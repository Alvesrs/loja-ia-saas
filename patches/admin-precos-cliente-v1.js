const fs=require('node:fs'),cp=require('node:child_process');
const copy=(a,b)=>fs.copyFileSync('patches/assets/'+a,b);
copy('condicoesComerciais.service.js','src/services/condicoesComerciais.service.js');
copy('admin-cliente-cadastro.html','public/admin-cliente-cadastro.html');
copy('admin-cliente-cadastro.js','public/js/admin-cliente-cadastro.js');
copy('admin-condicao-preco.js','public/js/admin-condicao-preco.js');
function edit(p,f){fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));}
edit('src/controllers/admin.controller.js',s=>{
 s="const comercial=require('../services/condicoesComerciais.service');\n"+s;
 s=s.replace('return res.json({ loja, situacao, planosDisponiveis: listarPlanos() });','return res.json({ loja, situacao, planosDisponiveis: await comercial.listar(lojaId), condicao_comercial: await comercial.obter(lojaId) });');
 s=s.replace("  const prefixo = email.split('@')[0].toLowerCase();",`  let condicao=null;
  try {if(req.body?.condicao_comercial!==undefined)condicao=comercial.cadastro(req.body.condicao_comercial);}catch(_){return res.status(400).json({erro:'Escolha um plano válido, preço positivo com até duas casas decimais e duração de 1, 3, 6 ou 12 meses.'});}
  const prefixo = email.split('@')[0].toLowerCase();`);
 s=s.replace("await definirAssinatura(lojaId, { plano: 'trial', status: 'inativo', valido_ate: null });",`if(condicao){
      await comercial.salvar(lojaId,condicao,req.usuario.id);
      await definirAssinatura(lojaId,{plano:condicao.plano,status:condicao.ativar?'ativo':'inativo',valido_ate:condicao.ativar?comercial.validade(condicao.duracao_meses):null});
    }else await definirAssinatura(lojaId, { plano: 'trial', status: 'inativo', valido_ate: null });`);
 s=s.replace('      confirmado: true,','      confirmado: true,\n      condicao_comercial: condicao,\n      ativacao_manual: Boolean(condicao?.ativar),');
 s+=`\nasync function planosCadastro(req,res){res.set('Cache-Control','no-store');return res.json({planos:listarPlanos().filter(p=>p.vendavel)});}
async function salvarCondicao(req,res){
 const lojaId=String(req.params.lojaId||'');if(!ehUuid(lojaId))return res.status(400).json({erro:'Identificador inválido.'});
 try {comercial.validar(req.body);const {data:loja,error}=await supabase.from('lojas').select('id').eq('id',lojaId).maybeSingle();if(error)throw error;if(!loja)return res.status(404).json({erro:'Empresa não encontrada.'});
 return res.json({condicao_comercial:await comercial.salvar(lojaId,req.body,req.usuario.id),planosDisponiveis:await comercial.listar(lojaId)});
 }catch(e){return res.status(e.message==='condicao_invalida'?400:500).json({erro:e.message==='condicao_invalida'?'Informe um plano válido e preço positivo com até duas casas decimais.':'Não foi possível salvar a condição comercial.'});}
}
module.exports.planosCadastro=planosCadastro;module.exports.salvarCondicao=salvarCondicao;\n`;
 return s;
});
edit('src/routes/admin.routes.js',s=>s.replace("router.get('/me', controller.me);","router.get('/me', controller.me);\nrouter.get('/planos-cadastro', exigirAdmin, controller.planosCadastro);\nrouter.put('/lojas/:lojaId/condicao-comercial', exigirAdmin, controller.salvarCondicao);"));
edit('src/services/asaas.service.js',s=>{
 s="const comercial=require('./condicoesComerciais.service');\n"+s;
 for(const name of ['criarPixPlano','criarCheckoutAssinatura']){const start=s.indexOf('async function '+name+'('),end=s.indexOf('\nasync function ',start+1);const segment=s.slice(start,end).replace('const plano = obterPlano(planoCodigo);','const plano = await comercial.planoParaLoja(lojaId,planoCodigo);');s=s.slice(0,start)+segment+s.slice(end);}
 const start=s.indexOf('async function criarCheckoutAssinatura('),end=s.indexOf('\nasync function ',start+1);s=s.slice(0,start)+s.slice(start,end).replace('valor_centavos: valorCentavos','valor_centavos: plano.precoMensalCentavos').replace('duracao_meses: meses','duracao_meses: 1')+s.slice(end);return s;
});
edit('src/controllers/clientePlano.controller.js',s=>"const comercial=require('../services/condicoesComerciais.service');\n"+s.replace('const planos=listarPlanos().map','const planos=(await comercial.listar(lojaId)).map').replace('codigo:p.codigo,','codigo:p.codigo,\n      precoPersonalizado:Boolean(p.precoPersonalizado),'));
edit('src/services/renovacao.service.js',s=>{
 s="const comercial=require('./condicoesComerciais.service');\n"+s;
 s=s.replace('function planosVendaveis(){','async function planosVendaveis(lojaId){').replace('return listarPlanos().filter','return (await comercial.listar(lojaId)).filter');
 s=s.replace('function textoPlanos(){','async function textoPlanos(lojaId){').replace('return planosVendaveis().map','return (await planosVendaveis(lojaId)).map');
 s=s.replace('function acharPlano(resposta){','async function acharPlano(resposta,lojaId){').replace('const ps=planosVendaveis();','const ps=await planosVendaveis(lojaId);');
 s=s.replaceAll('planosVendaveis().find','(await planosVendaveis(ctx.loja.id)).find').replaceAll('textoPlanos()','(await textoPlanos(ctx.loja.id))').replace('const plano=acharPlano(texto);','const plano=await acharPlano(texto,ctx.loja.id);');return s;
});
for(const p of ['public/admin-mobile.html','public/admin.html'])edit(p,s=>s.replace('</body>',`<script>document.addEventListener('DOMContentLoaded',()=>{const link=document.createElement('a');link.href='admin-cliente-cadastro.html';link.className='btn primary';link.textContent='Criar cliente com plano e preço exclusivo';link.style.cssText='display:block;padding:16px;margin:14px 0;text-align:center;border-radius:16px;text-decoration:none;background:#a670f4;color:#130a20;font-weight:700';const target=document.getElementById('view-registro')||document.getElementById('admin-cliente-form')||document.querySelector('main');if(target){target.prepend(link);if(target.id==='view-registro'){target.querySelectorAll('.card').forEach(card=>card.classList.add('hidden'));const intro=document.createElement('p');intro.className='sub';intro.textContent='Cadastre o cliente, escolha o plano e defina o preço combinado em três etapas.';target.prepend(intro);}}const old=document.getElementById('criar');if(old){old.textContent='Abrir cadastro guiado';old.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();location.href=link.href;},true);}});</script></body>`));
edit('public/admin-cliente-plano.html',s=>s.replace('</body>','<script src="js/admin-condicao-preco.js?v=2026.10.04.4"></script></body>').replace("st.textContent='Plano ativado.'","st.textContent='Acesso liberado manualmente. Nenhum pagamento foi confirmado.'").replace('Pagamento confirmado. Plano ativado automaticamente.','Acesso ativo. Confira a confirmação na cobrança.').replace('(dados.planosDisponiveis||[]).map','(dados.planosDisponiveis||[]).filter(p=>p.vendavel).map'));
edit('public/cliente-plano.html',s=>s.replace("if(!selected||!sell.some(x=>x.codigo===selected.codigo))selected=sell.find(x=>x.codigo===p.codigo)||sell[0]||null;","selected=sell.find(x=>x.codigo===selected?.codigo)||sell.find(x=>x.codigo===p.codigo)||sell[0]||null;").replace("esc(x.nome)+'</div><div class=\"plan-price\">'","esc(x.nome)+(x.precoPersonalizado?' · Condição negociada':'')+'</div><div class=\"plan-price\">'"));
edit('src/app.js',s=>s.replace("app.use('/painel', require('express').static(__saintsaiPublicDir, {","app.use('/painel',(req,res,next)=>{if(/^\\/(?:admin-(?:mobile|cliente-cadastro|cliente-plano)\\.html|js\\/admin-(?:cliente-cadastro|condicao-preco)\\.js)$/.test(req.path))res.set('Cache-Control','no-store, no-cache, must-revalidate');next();});\napp.use('/painel', require('express').static(__saintsaiPublicDir, {"));
fs.writeFileSync('public/cliente-versao.json',JSON.stringify({versao:'2026.10.04.4',publicado_em:'2026-10-04',novidades:['Cadastro administrativo com preço por cliente','Condições comerciais preservadas na renovação']})+'\n');
for(const p of ['src/controllers/admin.controller.js','src/routes/admin.routes.js','src/services/asaas.service.js','src/services/renovacao.service.js','src/controllers/clientePlano.controller.js','public/js/admin-cliente-cadastro.js','public/js/admin-condicao-preco.js'])cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
console.log('[admin-precos-cliente-v1] cadastro e preços exclusivos configurados.');
