'use strict';
/**
 * Gate for REAL business website proposals. Must run before generation AND before publication.
 * Metadata/authorization claims MUST come from independently checked sources upstream.
 * This module does NOT fetch photos, create websites or send messages.
 */
const SOURCE_TYPES=new Set(['instagram','facebook','google_maps','maps','site','cardapio']);
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const https=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password&&!['localhost','127.0.0.1'].includes(u.hostname);}catch{return false;}};
const canonical=s=>{try{const u=new URL(s);u.hash='';return u.href;}catch{return '';}};
const catalog=[
  {id:'lanchonete',aliases:['lanchonete','hamburgueria','pizzaria','snack bar','restaurante','fast food'],sections:['cardapio','produtos','lanches'],actions:['pedido','cardapio'],banned:['tatuagem','barbearia','cortes de cabelo']},
  {id:'tatuagem',aliases:['tatuagem','tattoo','estudio de tatuagem'],sections:['portfolio','trabalhos'],actions:['orcamento','agendamento'],banned:['cardapio','hamburguer','lanches']},
  {id:'barbearia',aliases:['barbearia','barber shop','barber'],sections:['servicos','cortes'],actions:['agendamento','contato'],banned:['hamburguer','tatuagem','cardapio']},
  {id:'salao',aliases:['salao','estetica','manicure'],sections:['servicos','procedimentos'],actions:['agendamento','contato'],banned:['hamburguer','cardapio']},
  {id:'loja',aliases:['loja','varejo','boutique','roupas'],sections:['produtos','catalogo'],actions:['pedido','comprar','contato'],banned:['cardapio de lanches','portfolio de tatuagem']},
];
const family=s=>catalog.find(g=>g.aliases.some(x=>norm(s)===x||norm(s).includes(x)))||null;
const failure=(message,audit)=>{const e=new Error(message);e.audit=audit;throw e;};
function checkCandidate(candidate){
  const c=candidate||{},errors=[],warnings=[];
  const fail=(code)=>errors.push(code);
  if(!c.id||!c.name||!c.city||!c.category||c.identityResolved!==true||c.categoryVerified!==true||c.primaryActionVerified!==true||!family(c.category))fail('business_identity_unverified');
  const sources=(Array.isArray(c.sources)?c.sources:[]).filter(x=>x?.businessId===c.id&&SOURCE_TYPES.has(x.platform)&&x.verified===true&&https(x.url)&&/^\d{4}-\d{2}-\d{2}$/.test(x.checkedAt||''));
  if(!sources.length)fail('sources_missing');
  if(c.brand?.identityVerified!==true||!Array.isArray(c.brand?.colors)||!c.brand.colors.length||!sources.some(x=>x.url===c.brand?.sourceUrl))fail('brand_missing');
  const photos=[],seen=new Set();
  for(const p of Array.isArray(c.referencePhotos)?c.referencePhotos:[]){
    if(p?.businessId!==c.id||p.kind!=='real'||p.aiGenerated!==false||p.stock===true||p.verified!==true||!https(p.imageUrl)||!https(p.originUrl)||!sources.some(x=>x.url===p.originUrl))continue;
    const url=canonical(p.imageUrl).split('?')[0];if(seen.has(url))continue;seen.add(url);photos.push(p);
  }
  if(photos.length<3)fail('real_photos_insufficient');
  if(!photos.some(x=>x.role==='hero'&&x.width>=1000&&x.height>=500&&x.width/x.height>=1.3))fail('real_hero_missing');
  if(!photos.some(x=>['product','service','ambience','storefront'].includes(x.subject)))fail('photos_off_topic');
  if(photos.some(p=>p.permission!=='authorized'||!p.permissionSource))warnings.push('photo_rights_pending');
  return {status:errors.length?'NAO_APTO_REFERENCIAS':warnings.length?'AGUARDA_AUTORIZACAO':'APTO_REFERENCIAS',ok:errors.length===0&&warnings.length===0,errors,warnings,photoCount:photos.length,sourcesCount:sources.length,photos};
}
function assertCandidate(candidate){const audit=checkCandidate(candidate);if(!audit.ok)failure('Geração bloqueada: referências reais insuficientes ou sem autorização.',audit);return audit;}
function referencedImages(html){
  const out=new Set();
  if(typeof html!=='string')return out;
  for(const tag of html.match(/<(?:img|source)\b[^>]*>/gi)||[]){
    for(const match of tag.matchAll(/\b(src|srcset|data-src)\s*=\s*(['"])(.*?)\2/gi)){
      if(match[1].toLowerCase()==='srcset'){for(const v of match[3].split(','))out.add(v.trim().split(/\s+/)[0]);}
      else out.add(match[3].trim());
    }
  }
  for(const m of html.matchAll(/\burl\(\s*(['"]?)(.*?)\1\s*\)/gi)){const s=m[2].trim();if(s&&!s.startsWith('#')&&!/\.(woff2?|ttf|otf)([?#]|$)/.test(s))out.add(s);}
  return out;
}
function checkProposal(candidate,proposal,html,{requireApproval=false}={}){
  const basic=checkCandidate(candidate), errors=[...basic.errors,...basic.warnings],c=candidate||{},p=proposal||{},site=p.site||{};
  const f=family(c.category),sf=family(site.category);
  if(!basic.ok)errors.push('candidate_not_eligible');
  if(p.business?.id!==c.id)errors.push('business_mismatch');
  if(!f||!sf||f.id!==sf.id)errors.push('site_category_mismatch');
  const sections=norm((site.sections||[]).map(x=>typeof x==='string'?x:(x?.title||x?.kind||'')).join(' '));
  if(f&&!f.sections.some(s=>sections.includes(s)))errors.push('missing_business_section');
  if(f&&f.banned.some(s=>sections.includes(s)))errors.push('wrong_business_content');
  if(f&&!f.actions.some(a=>(site.actions||[]).some(v=>norm(v.kind).includes(a)&&https(v.url))))errors.push('missing_real_business_action');
  const whitelist=new Map(basic.photos.map(p=>[canonical(p.imageUrl),p]));
  if(!Array.isArray(site.images)||!site.images.length)errors.push('no_authorized_photos_used');
  for(const m of site.images||[]){
    const src=whitelist.get(canonical(m?.url));
    if(!src||m.businessId!==c.id||m.kind!=='real'||m.aiGenerated!==false||m.stock===true||m.permission!=='authorized'||m.originUrl!==src.originUrl)errors.push('image_not_authorized_for_business');
  }
  if(typeof html!=='string')errors.push('rendered_html_missing');
  else {
    for(const src of referencedImages(html))if(!https(src)||!whitelist.has(canonical(src)))errors.push('rendered_image_not_authorized');
    if(/imagegen|midjourney|stable.diffusion|dall.e|ai.generated/i.test(html))errors.push('ai_media_marker_detected');
  }
  if(requireApproval&&p.ownerApproval!==true)errors.push('explicit_approval_missing');
  return {ok:errors.length===0,errors:[...new Set(errors)],businessId:c.id,category:f?.id||null,photoCount:basic.photoCount};
}
async function createCheckedPreview(candidate,{generate,render}={}){
  if(typeof generate!=='function'||typeof render!=='function')throw Error('Gerador e renderizador são obrigatórios.');
  assertCandidate(candidate); // Critical: abort before any call to generator.
  const result=await generate({candidate:structuredClone(candidate),allowedImages:structuredClone(candidate.referencePhotos)});
  const draft={...result,ownerApproval:false};
  const html=await render(draft);
  const audit=checkProposal(candidate,draft,html);
  if(!audit.ok)failure('Site reprovado antes de apresentar proposta.',audit);
  return {proposal:draft,html,audit,approvalRequired:true};
}
async function publishChecked(candidate,proposal,html,publish){
  if(typeof publish!=='function')throw Error('Publicador obrigatório.');
  const audit=checkProposal(candidate,proposal,html,{requireApproval:true});
  if(!audit.ok)failure('Publicação bloqueada pelo filtro de qualidade.',audit);
  return publish({candidate,proposal,html});
}
module.exports={checkCandidate,assertCandidate,checkProposal,createCheckedPreview,publishChecked,referencedImages};
