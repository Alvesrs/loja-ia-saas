const fs=require('node:fs');
const p='public/admin-mobile.html';
let h=fs.readFileSync(p,'utf8');

if(!h.includes('saints-header-v8')){
  const css='<style id="saints-header-v8">'+
  '.app{padding-top:0!important}'+
  '.saintsHeader{position:sticky!important;top:0!important;z-index:80!important;min-height:86px!important;margin:0 -12px 14px!important;padding:calc(10px + env(safe-area-inset-top)) 64px 10px!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important}'+
  '.saintsBrand{width:100%!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;pointer-events:none!important}'+
  '.saintsWord{text-align:center!important}'+
  '.saintsBy{text-align:center!important;padding-left:0!important}'+
  '.saintsMenu{position:absolute!important;left:14px!important;right:auto!important;bottom:50%!important;transform:translateY(50%)!important;margin:0!important}'+
  '.pageLead{margin-top:0!important}'+
  '</style>';
  h=h.replace('</head>',css+'</head>');
}
fs.writeFileSync(p,h);
console.log('Admin header v8 aplicado: menu à esquerda, marca centralizada e topo sem faixa vazia.');
