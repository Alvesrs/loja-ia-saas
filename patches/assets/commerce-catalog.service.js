const db=require('../config/supabase');
const {escolhas}=require('./acoesWhatsapp.service');
const normal=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v));
const safe=v=>String(v||'').replace(/[\x00-\x1f]/g,' ').slice(0,600);
function available(p){return p.ativo===true&&Array.isArray(p.estoque)&&p.estoque.some(e=>Number.isFinite(e.quantidade)&&e.quantidade>0);}
async function tentar(m){
 const raw=String(m.texto||m.pergunta||'').trim();const named=raw.match(/^escolher produto (.{1,150})$/i);const t=normal(raw);const selected=t.match(/^produto ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);
 const paging=t.match(/^catalogo pagina ([1-9]\d{0,2})$/);
 const request=/^(catalogo|produtos|ver produtos|listar produtos|quais produtos( voces tem| tem| estao disponiveis)?\??|quero (ver|escolher|selecionar|comprar) (um produto|produtos))$/.test(t);
 if(!selected&&!named&&!paging&&!request)return null;
 let q=db.from('produtos').select('id,nome,descricao,preco,categoria,ativo,estoque(tamanho,cor,quantidade)').eq('loja_id',m.lojaId).eq('ativo',true);
 if(selected)q=q.eq('id',selected[1]);else if(named)q=q.eq('nome',named[1]);
 const {data,error}=await q.order('nome').limit(1000);if(error)throw error;
 const items=(data||[]).filter(available);
 if(selected||named){const p=items[0];if(!p)return{resposta:'Esse produto não está disponível nesta loja. Peça “ver produtos” para consultar o catálogo atual.'};return{resposta:safe(p.nome)+' · '+money(p.preco)+'\n'+safe(p.descricao)+'\nOpções disponíveis: '+[...new Set(p.estoque.filter(e=>e.quantidade>0).map(e=>[e.tamanho,e.cor].filter(Boolean).map(safe).join(' / ')||'Padrão'))].join(', ')+'.\nInforme a opção e a quantidade desejadas para o responsável confirmar o pedido e o pagamento.'};}
 if(!items.length)return{resposta:'Não há produtos disponíveis no catálogo neste momento. O responsável pode confirmar outras opções.'};
 const page=Number(paging?.[1]||1),start=(page-1)*9,rows=items.slice(start,start+9);
 if(!rows.length)return{resposta:'Essa página não existe. Envie “ver produtos” para começar.'};
 const options=rows.map(p=>({value:'produto '+p.id,title:safe(p.nome),description:money(p.preco)+' · '+safe(p.descricao),forceList:true}));
 if(start+9<items.length)options.push({value:'catalogo pagina '+(page+1),title:'Mais produtos',description:'Próxima página do catálogo',forceList:true});
 return{resposta:'Escolha um produto para ver preço, descrição e opções disponíveis:\n'+rows.map(p=>safe(p.nome)+' · '+money(p.preco)+'\nPara selecionar, envie: escolher produto '+safe(p.nome)).join('\n')+(start+9<items.length?'\nMais opções: catalogo pagina '+(page+1):''),interativo:escolhas(options)};
}
module.exports={tentar,available};
