const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(process.env.PANEL_PUBLIC||'public');
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||undefined,args:['--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:Number(process.env.PANEL_WIDTH||393),height:852}}),page=await context.newPage(),errors=[],calls=[],starts=[];let failStart=false,pendingStart=false;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://panel.test/**',async route=>{const file=path.join(root,new URL(route.request().url()).pathname);if(!file.startsWith(root+path.sep))return route.fulfill({status:403});try{await route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'})}catch{await route.fulfill({status:404})}});
 await page.addInitScript(()=>{localStorage.setItem('lojaia_sessao',JSON.stringify({token:'test',usuario:{id:'owner',papel:'admin'}}));window.updateCalls=0;window.whatsappCalls=[];window.AndroidAgent={openWhatsApp(phone){window.whatsappCalls.push(phone)},installLatest(){window.updateCalls++},getVersionName(){return'1.0.24'}};});
 await page.route('**/api/**',async route=>{
 const url=new URL(route.request().url());let data={};
 if(url.pathname.endsWith('/admin/central-saas'))data={resumo:{},clientes:[],recebimentos:[],total_paginas:1,total:0};
 else if(url.pathname.endsWith('/admin/vendas/resumo'))data={hoje:{vendas:3,lucro:123,clientes:2,faturamento:300},mes:{lucro:456,faturamento:900,ticket_medio:100},clientes:{ativos:7},estoque:{baixo:0,zerado:0},recentes:[]};
 else if(url.pathname.endsWith('/minhas-lojas'))data={lojas:[{id:'store',nome:'Minha loja'}]};
 else if(url.pathname.endsWith('/prospeccao/iniciar')){starts.push(route.request().postDataJSON());await new Promise(resolve=>setTimeout(resolve,150));if(failStart)return route.fulfill({status:503,json:{erro:'Reconecte o WhatsApp antes de prospectar.'}});data={ok:true,status:pendingStart?'pendente_entrega':starts.length===1?'enviada':'ja_enviada'};}
 else if(url.pathname.endsWith('/prospeccao/buscar')){calls.push(url.search);const offset=Number(url.searchParams.get('offset'));data={leads:[{id:'a',nome:'Padaria A',telefone:'5543999991111',whatsapp:'https://api.whatsapp.com/send?phone=5543999991111'},{id:offset?'c':'b',nome:offset?'Padaria C':'Padaria B'}],nextOffset:offset+2,hasMore:true};}
 else if(/clientes-gerenciados|historico|planos/.test(url.pathname))data=[];
 else if(url.pathname.endsWith('/admin/me'))data={papel:'admin',id:'owner'};
 await route.fulfill({json:data});
 });
 await page.goto('http://panel.test/admin-mobile.html');
 await page.waitForFunction(()=>document.querySelector('#saas-central #home-prospecting')&&document.querySelector('#mLucroHoje').textContent.includes('123'));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'sem conteúdo cortado lateralmente');
 assert(await page.locator('#home-prospecting').isVisible(),'prospecção deve estar visível no painel montado');
 assert.equal(await page.locator('#saas-central>.metricGrid>.metric').count(),4);
 assert.deepEqual(await page.locator('#saas-central>.metricGrid strong').evaluateAll(xs=>xs.map(x=>x.id)),['mLucroHoje','mLucroMes','mClientesHoje','mClientesAtivos']);
 const positions=await page.locator('#saas-central').evaluate(p=>[p.querySelector('.metricGrid').getBoundingClientRect().bottom,p.querySelector('#home-prospecting').getBoundingClientRect().top]);assert(positions[0]<=positions[1]);
 const cities=await page.locator('#homeProsCity option').allTextContents();assert(cities.length>300);assert.deepEqual(cities.slice(1),cities.slice(1).sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'})));
 await page.selectOption('#homeProsCity','Londrina');await page.click('#homeProsSearch');await page.waitForSelector('[data-id="a"]');
 await page.locator('[data-home-wa]').evaluate(a=>{a.click();a.click()});await page.waitForFunction(()=>window.whatsappCalls.length===1);assert.deepEqual(starts,[{lojaId:'store',telefone:'5543999991111'}],'envia a primeira abordagem uma vez mesmo com dois toques');
 await page.click('[data-home-wa]');await page.waitForFunction(()=>window.whatsappCalls.length===2);assert((await page.locator('#homeProsStatus').textContent()).includes('já foi enviada'),'não promete repetir a abordagem');
 failStart=true;await page.click('[data-home-wa]');await page.waitForFunction(()=>document.querySelector('#homeProsStatus').textContent.includes('Reconecte'));assert.equal(await page.evaluate(()=>window.whatsappCalls.length),2,'erro não abre WhatsApp nem afirma envio');failStart=false;
 pendingStart=true;await page.click('[data-home-wa]');await page.waitForFunction(()=>document.querySelector('#homeProsStatus').textContent.includes('entrega ainda não confirmada'));assert.equal(await page.evaluate(()=>window.whatsappCalls.length),3);pendingStart=false;assert.equal(await page.locator('#homeProsCategory option[value="odontologia"]').count(),1);
 const startsBeforeManual=starts.length;await page.click('[data-home-manual]');assert.equal(starts.length,startsBeforeManual,'envio manual não chama API de início');assert.equal(await page.evaluate(()=>window.whatsappCalls.length),4);assert((await page.locator('#homeProsStatus').textContent()).includes('agente não foi iniciado'));
 await page.click('[data-id="a"] [data-action="contatado"]');assert.equal(await page.locator('[data-id="a"]').count(),0);
 await page.click('#homeProsRefresh');await page.waitForSelector('[data-id="c"]');assert(calls[1].includes('offset=2'));assert.equal(await page.locator('[data-id="a"]').count(),0);
 assert(await page.locator('#homeProsCards').evaluate(x=>getComputedStyle(x).display==='flex'&&(innerWidth>=900||x.scrollWidth>x.clientWidth)));
 await page.locator('#rm-interface-update').click();assert.equal(await page.evaluate(()=>window.updateCalls),1);
 const screenshot=process.env.PANEL_SCREENSHOT||'/tmp/saints-panel-phone.png';fs.mkdirSync(path.dirname(screenshot),{recursive:true});await page.screenshot({path:screenshot,fullPage:true});
 await page.reload();await page.waitForSelector('#saas-central #home-prospecting');await page.selectOption('#homeProsCity','Londrina');await page.click('#homeProsSearch');await page.waitForSelector('[data-id="b"]');assert.equal(await page.locator('[data-id="a"]').count(),0,'contatado continua excluído após reabrir');
 await page.getByRole('button',{name:'Clientes',exact:true}).last().click();assert(await page.locator('#view-clientes').isVisible());
 assert.deepEqual(errors,[],'sem erros de JavaScript na tela');console.log('PASS: Home visível, lucro real, cidades ordenadas, faixa horizontal, próximo lote, contato persistido, botão APK, clientes, abordagem inicial, dois toques e falha de envio.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
