const fs=require('node:fs');
const cp=require('node:child_process');
const p='public/cliente-login.html';
let h=fs.readFileSync(p,'utf8');
if(!h.includes('SAINTSAI_CLIENT_REGISTER_V1')){
 const block=`<!-- SAINTSAI_CLIENT_REGISTER_V1 -->
<div style="margin-top:14px;text-align:center">
  <div style="font-size:12px;color:#9f98ad;margin-bottom:8px">Ainda não tem uma conta?</div>
  <a href="/comprar.html" style="display:block;text-decoration:none;border:1px solid rgba(168,85,247,.28);background:rgba(126,63,231,.10);color:#d9c1ff;border-radius:14px;padding:12px 14px;font-weight:900">Criar conta</a>
</div>`;
 const end=h.lastIndexOf('</form>');
 if(end<0)throw new Error('Formulário de login do cliente não encontrado');
 h=h.slice(0,end+7)+block+h.slice(end+7);
}
fs.writeFileSync(p,h);
if(!h.includes('href="/comprar.html"'))throw new Error('Botão Criar conta não aplicado');
console.log('[client-register] PASS botão Criar conta no login');