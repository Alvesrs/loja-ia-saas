const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const profiles=require('../patches/assets/business-profiles.service.js');
const clientScript=fs.readFileSync(path.join(__dirname,'../patches/assets/cliente-business-profile.js'),'utf8');
const base=[
 {chave:'nome_empresa',pergunta:'Nome?'},
 {chave:'ramo',pergunta:'Ramo?'},
 {chave:'produtos_servicos',pergunta:'Produtos ou serviços?'},
 {chave:'horario',pergunta:'Horário?'},
 {chave:'pagamentos',pergunta:'Pagamentos?'},
 {chave:'entrega',pergunta:'Entrega?'},
 {chave:'tom',pergunta:'Tom?'},
 {chave:'regras',pergunta:'Regras?'}
];

test('identifica categorias profissionais com e sem acentos',()=>{
 assert.equal(profiles.identify('Estúdio de tatuagem'),'tatuagem');
 assert.equal(profiles.identify('Barbearia'),'barbearia');
 assert.equal(profiles.identify('Salão de beleza'),'salao');
 assert.equal(profiles.identify('Moda feminina'),'roupas');
 assert.equal(profiles.identify('Assistência técnica'),'geral');
});

test('briefing adapta as perguntas e inclui profissionais para serviços presenciais',()=>{
 const barber=profiles.fields(base,{ramo:'barbearia'});
 assert.equal(barber.length,base.length+1);
 assert.match(barber[2].pergunta,/preços e duração/i);
 assert.equal(barber[3].chave,'profissionais');

 const tattoo=profiles.fields(base,{ramo:'estúdio de tatuagem'});
 assert.match(tattoo[2].pergunta,/estilos e serviços/i);
 assert.equal(tattoo[3].chave,'profissionais');

 const clothes=profiles.fields(base,{ramo:'loja de roupas'});
 assert.equal(clothes.length,base.length);
 assert.match(clothes[2].pergunta,/preço, tamanhos e cores/i);
 assert.match(clothes[5].pergunta,/entrega, retirada e troca/i);
});

test('vendedor do cadastro automático usa a sequência adaptada pelo ramo',()=>{
 const seller=fs.readFileSync(path.join(__dirname,'../src/services/salesSeller.service.js'),'utf8');
 assert.match(seller,/businessProfiles\.service'\)\.fields\(CAMPOS_BRIEFING,lead\.briefing\|\|\{\}\)/);
 assert.match(seller,/return seguintes\[proximo\]\.pergunta/);
 const prospecting=fs.readFileSync(path.join(__dirname,'../public/admin-prospeccao.html'),'utf8');
 assert.match(prospecting,/<option value="roupas">Loja de roupas<\/option>/);
});

test('prompt limita a IA aos dados cadastrados e informa que a prévia de tatuagem não existe',()=>{
 const tattoo=profiles.prompt({ramo:'tatuagem'},{});
 assert.match(tattoo,/Simular tatuagens.*recurso futuro indisponível/i);
 assert.match(tattoo,/Não garanta resultados/);
 const clothes=profiles.prompt({ramo:'roupas'},{});
 assert.match(clothes,/preços, cores, tamanhos e disponibilidade cadastrada/i);
 assert.match(clothes,/Não invente estoque/);
});

function renderCentral(profile){
 const children=[];
 const target={before(node){children.push(node);}};
 const makeNode=()=>({style:{},children:[],append(...items){this.children.push(...items);}});
 const document={
  readyState:'complete',
  querySelector(selector){return selector==='.sa-shortcuts'?target:null;},
  getElementById(){return null;},
  createElement(){return makeNode();}
 };
 vm.runInNewContext(clientScript,{
  document,location:{pathname:'/cliente-central.html'},
  obterUsuario:()=>({app_metadata:{saintsai_business_profile:profile}})
 });
 return children[0];
}

test('área do cliente mostra atalhos adequados ao perfil salvo no cadastro',()=>{
 const barber=renderCentral('barbearia');
 assert.match(barber.children[0].textContent,/Barbearia/);
 assert(barber.children[2].children.some(link=>link.href.includes('cliente-agenda.html')));
 assert(barber.children[2].children.some(link=>link.textContent==='Galeria de cortes'));

 const tattoo=renderCentral('tatuagem');
 assert.match(tattoo.children[1].textContent,/ainda não está disponível/);
 assert(tattoo.children[2].children.some(link=>link.textContent==='Portfólio'));
 const clothes=renderCentral('roupas');
 assert(clothes.children[2].children.some(link=>link.href.includes('cliente-produtos.html')));
});

test('galeria de roupas apresenta instrução sobre fotos, vídeos e etiquetas',()=>{
 let intro={textContent:''};
 const document={
  readyState:'complete',
  querySelector(selector){return selector==='.gallery-intro'?intro:null;},
  getElementById(){return null;},
  createElement(){throw new Error('A tela da galeria não deve criar outro painel.');}
 };
 vm.runInNewContext(clientScript,{
  document,location:{pathname:'/cliente-galeria.html'},
  obterUsuario:()=>({app_metadata:{saintsai_business_profile:'roupas'}})
 });
 assert.match(intro.textContent,/cada foto e vídeo/);
 assert.match(intro.textContent,/tipo de peça, cor, coleção e tamanho/);
});
