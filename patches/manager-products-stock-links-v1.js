const fs=require('node:fs');
const file='public/gerenciador.html';
let h=fs.readFileSync(file,'utf8');

if(!h.includes('id="managerProdutosBtn"')){
  h=h.replace(
    '<button id="nova" class="btn">＋ Registrar venda</button></header>',
    '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><a id="managerProdutosBtn" class="btn" href="cliente-produtos.html" style="text-decoration:none;background:#176ac9">Produtos</a><a id="managerEstoqueBtn" class="btn" href="cliente-estoque.html" style="text-decoration:none;background:#526274">Estoque</a><button id="nova" class="btn">＋ Registrar venda</button></div></header>'
  );
}
fs.writeFileSync(file,h);
console.log('Gerenciador: atalhos de Produtos e Estoque aplicados.');
