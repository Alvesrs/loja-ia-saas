const fs=require('fs'),path=require('path'),assert=require('assert');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const root=process.cwd()+'/public';
const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';const client={id,loja_id:id,nome:'Studio Aurora',ativo:true,plano:'Profissional',uso:{limite:1000,utilizado:120,restante:880},mensalidade_centavos:10000,recebido_centavos:10000};
const api=`class SessaoExpiradaError extends Error{};async function apiFetch(url,opts){if(url.includes('central-saas'))return ${JSON.stringify({resumo:{clientes_pagantes:1,total_centavos:120000,mes_centavos:30000,ativos:1,vencendo:0,clientes:1},clientes:[client],recebimentos:[],total:1,total_paginas:1})};if(url.endsWith('/marca'))return {nome:'Studio Aurora',imagem_url:null};if(url.endsWith('/cliente-financeiro'))return {hoje:{vendido:450,recebido:280,clientes:3},aberto:{receber:170},mes:{vendido:2800,recebido:1300},registros:[{nome:'Ana',servico:'Corte',valor:150,pagamento_status:'pago',inicio:'2026-10-07T15:00:00Z'}]};if(url.endsWith('/onboarding'))return {percentual:100,etapas:[]};if(url.endsWith('/cliente-hub'))return {loja:{nome:'Studio Aurora'},metricas:{},servicos:[],agenda:[],pagamentos:{conectado:true,provedor:'asaas'},agenda_config:{}};if(url.includes('/clientes'))return [${JSON.stringify(client)}];if(url.includes('/galeria'))return {midias:[],total:0};return [];}`;

(async()=>{const browser=await chromium.launch({headless:true});try{
const page=await browser.newPage({colorScheme:'dark'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(({id})=>{localStorage.setItem('lojaia_sessao',JSON.stringify({token:'fixture',usuario:{id:'owner',papel:'admin'}}));sessionStorage.setItem('lojaia_loja_atual',JSON.stringify({id,nome:'Studio Aurora'}));localStorage.setItem('lojaia-tema','escuro');},{id});
await page.route('**/*',async r=>{const u=new URL(r.request().url());const f=path.join(root,u.pathname);try{await r.fulfill({contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.json')?'application/json':'text/html',body:fs.readFileSync(f)});}catch{await r.fulfill({status:404,body:'missing'});}});
await page.route('**/js/api.js*',r=>r.fulfill({contentType:'text/javascript',body:api}));
fs.mkdirSync('ui-artifacts',{recursive:true});
for(const width of [320,390,768,1440])for(const file of ['cliente-central.html','admin-mobile.html','cliente-galeria.html','cliente-produtos.html','cliente-agente.html','cliente-agenda.html','cliente-configuracao.html','cliente-login.html']){
 await page.setViewportSize({width,height:1000});await page.goto('http://local/'+file);await page.waitForFunction(()=>document.body.classList.contains('sa-neon'));await page.waitForTimeout(250);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow){console.log('OVERFLOW',width,file,await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(n=>n.getBoundingClientRect().right>innerWidth+2).slice(0,10).map(n=>[n.tagName,n.className,n.id,n.getBoundingClientRect().right])));throw Error('overflow')}
 assert(await page.evaluate(()=>{const a=[...document.querySelectorAll('[id]')].map(n=>n.id);return a.length===new Set(a).size}),file+' duplicate IDs');
 if(file==='cliente-central.html'){
 assert.equal(await page.locator('.neon-overview .sa-stat').count(),4);assert((await page.locator('#sa-received').textContent()).includes('280'));
 await page.locator('[data-st-panel=st-finance]').click();assert(await page.locator('#sa-month-received').isVisible());await page.locator('[data-st-panel=st-activity]').click();assert(await page.locator('#sa-records').isVisible());await page.locator('[data-st-panel=st-day]').click();
 if(width<901){await page.locator('.sa-business-menu').click();assert(await page.locator('#sa-menu').isVisible());await page.keyboard.press('Escape');}
 }
 if(file==='admin-mobile.html'){
 assert(await page.locator('.neon-admin-hero').isVisible());assert(await page.locator('.st-owner-pulse').isVisible());
 await page.locator('[data-owner-clients]').click();assert(await page.locator('#saas-search').isVisible());await page.evaluate(()=>showView('home'));assert(await page.locator('#homeProsSearch').isVisible());
 }
 await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0)});
 if([390,1440].includes(width))await page.screenshot({path:'ui-artifacts/neon-'+file.replace('.html','')+'-'+width+'.png',fullPage:true});
 await page.evaluate(()=>{document.documentElement.dataset.theme='light'});await page.waitForTimeout(700);
 if([390,1440].includes(width)&&['cliente-central.html','admin-mobile.html'].includes(file))await page.screenshot({path:'ui-artifacts/neon-light-'+file.replace('.html','')+'-'+width+'.png',fullPage:true});
 console.log('PASS',width,file);
}
console.log('PAGE_ERRORS',JSON.stringify([...new Set(errors)]));assert.equal(errors.length,0);console.log('ALL CHECKS PASSED');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
