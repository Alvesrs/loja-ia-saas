const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
async function tentar(args,c){const input=String(args.pergunta||''),n=norm(input);
 if(!/foto|imagem|video/.test(n)||!/\b(manda|mande|envia|envie|enviar|mostra|mostre|quero ver)\b/.test(n))return null;
 const busca=require('./galeriaBusca.helpers');if(!busca.pedido(input,[]))return null;
 let texto=input;if(/\bteste\b/.test(n))texto=/video/.test(n)&&!/foto|imagem/.test(n)?'video teste':'imagem teste';
 const r=await require('./galeriaAtendimento.service').tentar({lojaId:args.lojaId,contato:args.contato,configuracaoId:args.configuracaoId,texto},c.briefing?.__lab_history||[]);
 return r?{handled:true,response:r.resposta,...(r.midias?.length?{midias:r.midias}:{})}:null;
}
module.exports={tentar};
