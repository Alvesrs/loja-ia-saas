'use strict';const fs=require('node:fs');
for(const p of ['src/services/ownerSalesContext.service.js','patches/assets/owner-consultative/ownerSalesContext.service.js']){
 let s=fs.readFileSync(p,'utf8');
 const anchor='vamos almocar|vamos jantar|quem ganhou o jogo';
 if(!s.includes('fotos? da festa')){if(!s.includes(anchor))throw Error('Personal media boundary anchor missing');s=s.replace(anchor,'fotos? da festa|videos? da festa|vamos almocar|vamos jantar|quem ganhou o jogo');}if(!s.includes('comprou uma moto')){const purchase='comprar uma moto|comprar moto';if(!s.includes(purchase))throw Error('Personal story boundary anchor missing');s=s.replace(purchase,'comprou uma moto|comprar uma moto|comprar moto');}fs.writeFileSync(p,s);
}
