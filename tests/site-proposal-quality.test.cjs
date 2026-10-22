'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {checkCandidate,assertCandidate,checkProposal,createCheckedPreview,publishChecked}=require('../site-proposal-quality/gate.cjs');
function fixture(){
 const id='ficticia-1',src='https://instagram.com/empresa.ficticia';
 const photos=['hero','lanche','fachada'].map((name,i)=>({businessId:id,imageUrl:'https://cdn.exemplo-ficticio.org/'+name+'.jpg',originUrl:src,kind:'real',stock:false,aiGenerated:false,verified:true,width:i?900:1400,height:800,role:i?'gallery':'hero',subject:i===2?'storefront':'product',permission:'authorized',permissionSource:'autorização fictícia exclusivamente para teste'}));
 const candidate={id,name:'Lanchonete Fictícia',city:'Cambira',category:'lanchonete',identityResolved:true,categoryVerified:true,primaryActionVerified:true,sources:[{businessId:id,platform:'instagram',verified:true,url:src,checkedAt:'2026-10-18'}],brand:{identityVerified:true,colors:['#101010','#f7b82b'],sourceUrl:src},referencePhotos:photos};
 const proposal={business:{id,category:'lanchonete'},site:{category:'hamburgueria',sections:['cardapio'],actions:[{kind:'pedido',url:'https://pedido.exemplo-ficticio.org/'}],images:photos.map(p=>({url:p.imageUrl,originUrl:p.originUrl,businessId:id,kind:'real',aiGenerated:false,stock:false,permission:'authorized'}))}};
 const html='<main><img src="'+photos[0].imageUrl+'"><img src="'+photos[1].imageUrl+'"></main>';
 return {candidate,proposal,html};
}
test('valida referência verificável com 3 fotos autorizadas',()=>{const f=fixture();assert.equal(checkCandidate(f.candidate).status,'APTO_REFERENCIAS');assert.equal(checkProposal(f.candidate,f.proposal,f.html).ok,true)});
test('sem foto não executa o gerador',async()=>{const f=fixture();f.candidate.referencePhotos=[];let calls=0;await assert.rejects(createCheckedPreview(f.candidate,{generate:async()=>{calls++;return f.proposal},render:async()=>f.html}));assert.equal(calls,0)});
test('foto duplicada não conta no mínimo',()=>{const f=fixture();f.candidate.referencePhotos[2].imageUrl=f.candidate.referencePhotos[1].imageUrl;assert.equal(checkCandidate(f.candidate).ok,false)});
test('imagem de IA bloqueia antes da geração',()=>{const f=fixture();f.candidate.referencePhotos[1].aiGenerated=true;assert.throws(()=>assertCandidate(f.candidate))});
test('foto de outra empresa não é elegível',()=>{const f=fixture();f.candidate.referencePhotos[1].businessId='outra';assert.equal(checkCandidate(f.candidate).ok,false)});
test('sem foto horizontal principal não gera',()=>{const f=fixture();f.candidate.referencePhotos[0].width=400;assert.equal(checkCandidate(f.candidate).ok,false)});
test('fonte não verificada bloqueia',()=>{const f=fixture();f.candidate.sources[0].verified=false;assert.equal(checkCandidate(f.candidate).ok,false)});
test('autorização pendente bloqueia',()=>{const f=fixture();f.candidate.referencePhotos[0].permission='unknown';assert.equal(checkCandidate(f.candidate).status,'AGUARDA_AUTORIZACAO')});
test('não mistura ramo da lanchonete com tatuagem',()=>{const f=fixture();f.proposal.site.category='tatuagem';assert.equal(checkProposal(f.candidate,f.proposal,f.html).ok,false)});
test('reprova CTA sem pedido para lanchonete',()=>{const f=fixture();f.proposal.site.actions=[];assert.equal(checkProposal(f.candidate,f.proposal,f.html).ok,false)});
test('reprova mídia que não consta das fontes',()=>{const f=fixture();f.proposal.site.images[0].url='https://outro.example.org/lanche.jpg';assert.equal(checkProposal(f.candidate,f.proposal,f.html).ok,false)});
test('bloqueia foto de IA inserida no HTML por fora',()=>{const f=fixture();assert.equal(checkProposal(f.candidate,f.proposal,f.html+'<img src="https://fake.org/ai.jpg">').ok,false)});
test('bloqueia URL de imagem não autorizada no CSS',()=>{const f=fixture();assert.equal(checkProposal(f.candidate,f.proposal,f.html+'<style>.hero{background:url(https://fake.org/photo.jpg)}</style>').ok,false)});
test('requer auditoria do HTML final',()=>{const f=fixture();assert.equal(checkProposal(f.candidate,f.proposal,null).ok,false)});
test('prévia aprovada não pode ser publicada sem aprovação',async()=>{const f=fixture();const res=await createCheckedPreview(f.candidate,{generate:async()=>f.proposal,render:async()=>f.html});assert.equal(res.approvalRequired,true);assert.equal(res.proposal.ownerApproval,false);let calls=0;await assert.rejects(publishChecked(f.candidate,res.proposal,f.html,async()=>calls++));assert.equal(calls,0)});
test('publicação aceita só após revisão e aprovação',async()=>{const f=fixture();f.proposal.ownerApproval=true;let calls=0;const result=await publishChecked(f.candidate,f.proposal,f.html,async()=>{calls++;return{published:true}});assert.equal(calls,1);assert.equal(result.published,true)});
