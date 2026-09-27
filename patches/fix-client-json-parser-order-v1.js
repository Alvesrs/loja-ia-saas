const fs=require('node:fs');
const cp=require('node:child_process');
const p='src/app.js';
let s=fs.readFileSync(p,'utf8');

const parserBlock=`// Limite de tamanho do corpo da requisição, para evitar abuso com payloads
// enormes (o SaaS não lida com upload de arquivo nesta fase).
app.use(express.json({ limit: '100kb' }));`;

// Remove o parser da posição antiga, que estava depois das rotas do cliente.
if(s.includes(parserBlock)) s=s.replace(parserBlock,'');

// Mantém webhooks/raw parsers antes e ativa JSON antes das rotas normais autenticadas.
const anchor="app.post('/api/aprimorar-prompt', exigirLoginPrompt";
const i=s.indexOf(anchor);
if(i<0)throw new Error('Anchor antes das rotas autenticadas não encontrado');
if(!s.slice(0,i).includes("app.use(express.json({ limit: '100kb' }))")){
  s=s.slice(0,i)+parserBlock+'\n\n'+s.slice(i);
}

const jsonPos=s.indexOf("app.use(express.json({ limit: '100kb' }))");
const hubPos=s.indexOf("app.use('/api/lojas/:lojaId/cliente-hub', clienteHubRoutes);");
const wahaPos=s.indexOf("app.use('/api/webhooks/waha', whatsappWahaWebhookRoutes);");
if(jsonPos<0||hubPos<0||jsonPos>hubPos)throw new Error('Parser JSON ainda está depois do cliente-hub');
if(wahaPos>=0&&jsonPos<wahaPos)throw new Error('Parser JSON foi movido antes do webhook WAHA');

fs.writeFileSync(p,s);
cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
console.log('[json-order] PASS webhook -> json parser -> cliente-hub');