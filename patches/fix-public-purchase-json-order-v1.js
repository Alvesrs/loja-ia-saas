const fs=require('node:fs');
const cp=require('node:child_process');

const p='src/app.js';
let s=fs.readFileSync(p,'utf8');
const mount="app.use('/api/public/compra-saintsai', compraPublicaRoutes);";
const parser="app.use(express.json({ limit: '100kb' }));";

if(!s.includes(mount))throw new Error('Rota pública de compra não encontrada');
if(!s.includes(parser))throw new Error('Parser JSON não encontrado');

s=s.split(mount).join('');
const pos=s.indexOf(parser);
if(pos<0)throw new Error('Parser JSON não encontrado após remoção');
const end=pos+parser.length;
s=s.slice(0,end)+"\n"+mount+s.slice(end);

const jsonPos=s.indexOf(parser);
const compraPos=s.indexOf(mount);
const wahaPos=s.indexOf("app.use('/api/webhooks/waha', whatsappWahaWebhookRoutes);");
if(compraPos<jsonPos)throw new Error('Rota de compra ainda está antes do JSON parser');
if(wahaPos>=0&&jsonPos<wahaPos)throw new Error('JSON parser foi movido antes do webhook WAHA');

fs.writeFileSync(p,s);
cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
console.log('[public-purchase-json-order-v1] PASS webhook -> json parser -> compra pública');
