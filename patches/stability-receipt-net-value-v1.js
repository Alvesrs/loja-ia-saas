'use strict';
const fs=require('node:fs');
const payment='src/services/asaasAgendamentoPix.service.js';
let s=fs.readFileSync(payment,'utf8');
const anchor="if(i.event==='PAYMENT_RECEIVED')u.notificacao_venda_enfileirada=true;";
if(!s.includes('SAINTSAI_RECEIPT_NET_VALUE')){
 if(!s.includes(anchor))throw Error('Receipt update anchor missing');
 s=s.replace(anchor,anchor+"if(i.event==='PAYMENT_RECEIVED'&&process.env.SAINTSAI_RECEIPT_NET_VALUE==='1'){const net=Number(payload.payment?.netValue),gross=Number(payload.payment?.value);u.pagamento_valor_liquido=payload.payment?.netValue!=null&&Number.isFinite(net)&&net>0&&net<=gross?Number(net.toFixed(2)):null;}");
 fs.writeFileSync(payment,s);
}
for(const p of ['src/services/saleNotificationRetry.service.js','patches/assets/release-audit/saleNotificationRetry.service.js']){
 let t=fs.readFileSync(p,'utf8');
 if(t.includes('receiptNet'))continue;
 const select="select('id,loja_id,servico_id,cliente_nome,inicio,valor,pagamento_status,pagamento_provider_status')";
 const money='valor:Number(ag.valor)';
 if(!t.includes(select)||!t.includes(money))throw Error('Receipt worker anchors missing');
 t=t.replace(select,"select('*')").replace(money,"valor:receiptNet(ag)");
 // A missing net amount remains compatible with existing records and provider integrations.
 t+="\nfunction receiptNet(ag){const net=Number(ag.pagamento_valor_liquido),gross=Number(ag.valor);return ag.pagamento_valor_liquido!=null&&Number.isFinite(net)&&net>0&&net<=gross?net:gross;}\nmodule.exports.receiptNet=receiptNet;\n";
 fs.writeFileSync(p,t);
}
