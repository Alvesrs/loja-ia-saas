const fs=require('node:fs');
const file='public/login.html';
let h=fs.readFileSync(file,'utf8');
if(!h.includes('cadastro-gerenciador-independente.html')){
  const marker='</form>';
  const bloco='\n<div style="margin-top:14px;text-align:center"><a href="cadastro-gerenciador-independente.html" style="display:inline-flex;align-items:center;justify-content:center;width:100%;padding:13px 14px;border-radius:12px;border:1px solid rgba(139,92,246,.45);color:#c4b5fd;text-decoration:none;font-weight:800">Criar conta no Gerenciador</a><p style="margin:8px 0 0;font-size:12px;opacity:.72">Cadastro independente, sem vínculo com outro painel.</p></div>\n';
  if(h.includes(marker)) h=h.replace(marker,marker+bloco);
  else h=h.replace('</main>',bloco+'</main>');
}
fs.writeFileSync(file,h);
console.log('Login do Gerenciador atualizado com cadastro independente.');
