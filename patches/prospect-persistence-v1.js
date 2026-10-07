const fs=require('node:fs');
const page='public/admin-prospeccao.html';
let s=fs.readFileSync(page,'utf8');
s=s.replace("const key='saintsai-prospeccao-v1';",`const key='saintsai-prospeccao-v1';
const buscaKey='saintsai-prospeccao-busca-v1:'+String(obterUsuario()?.id||obterUsuario()?.email||'local');
let buscaConcluida=false;
function guardarBusca(){if(!buscaConcluida)return;try{localStorage.setItem(buscaKey,JSON.stringify({uf:$('uf').value,cidade:$('cidade').value,categoria:$('categoria').value,resultados:resultadoBusca,soSalvos,status:$('status').textContent,atribuicao:!$('maps-attribution').hidden}));}catch(_){}}
function restaurarBusca(){try{const v=JSON.parse(localStorage.getItem(buscaKey)||'null');if(!v||!Array.isArray(v.resultados))return;$('uf').value=v.uf;$('cidade').value=v.cidade;$('categoria').value=v.categoria;resultadoBusca=v.resultados;ultimo=resultadoBusca.filter(x=>estado()[x.id]!=='descartado');soSalvos=!!v.soSalvos;$('verSalvos').textContent=soSalvos?'← Ver todos':'☆ Só salvos';$('status').textContent=v.status;$('maps-attribution').hidden=!v.atribuicao;buscaConcluida=true;render();}catch(_){}}
window.addEventListener('pagehide',guardarBusca);`);
s=s.replace("function render(){\n", "function render(){\n $('restaurar').hidden=!resultadoBusca.some(x=>estado()[x.id]==='descartado');\n guardarBusca();\n");
s=s.replace("$('cards').innerHTML='';", "");
s=s.replace("   render();\n }catch(e)","   buscaConcluida=true;render();\n }catch(e)");
s=s.replace("$('cards').innerHTML='<div class=\"empty\">'+esc(e.message||'A fonte de contatos está indisponível agora. Tente novamente em alguns minutos.')+'</div>'", "if(!buscaConcluida)$('cards').innerHTML='<div class=\"empty\">'+esc(e.message||'A fonte de contatos está indisponível agora. Tente novamente em alguns minutos.')+'</div>'");
s=s.replace("</script>\n<script src=\"js/owner-prospecting", "restaurarBusca();\n</script>\n<script src=\"js/owner-prospecting");
s=s.replace(/2026\.10\.07\.12/g,'2026.10.07.13');
fs.writeFileSync(page,s);
const script='public/js/owner-prospecting.js';let js=fs.readFileSync(script,'utf8');
const start=js.indexOf(' function abrir(phone)'),end=js.indexOf('\n const section',start);
if(start<0||end<0)throw Error('Abertura de WhatsApp ausente');
js=js.slice(0,start)+` function abrir(phone){
 if(!/^55\\d{10,11}$/.test(phone))return;
 const bridge=window.AndroidAgent||window.AndroidClient;
 if(bridge&&typeof bridge.openWhatsApp==='function'){bridge.openWhatsApp(phone);return;}
 // A real user click must open an external browsing context, never navigate this WebView.
 const popup=window.open('https://api.whatsapp.com/send?phone='+phone,'_blank');
 if(!popup){status.textContent='Permita abrir o WhatsApp e toque novamente no contato.';}
 }
`+js.slice(end);
js=js.replace("if(window.AndroidAgent&&typeof AndroidAgent.openWhatsApp==='function')AndroidAgent.openWhatsApp(phone);else location.href='https://api.whatsapp.com/send?phone='+phone;",'abrir(phone);');
fs.writeFileSync(script,js);
