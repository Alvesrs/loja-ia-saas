'use strict';
const fs=require('node:fs');
const file='src/services/ownerSalesContext.service.js';
const early="if(t&&active&&lead&&/^prospeccao:(aberto|iniciado):/.test(lead.ultimo_evento_id||'')&&!lead.briefing?.__sales_stop)return true;";
const guard="if(!t||personal(t)||require('./ownerSalesPolicy').foraDoEscopo(text))return false;";
const source=fs.readFileSync(file,'utf8');
if(!source.includes(guard+early)){
 if(!source.includes(early+guard))throw Error('Commercial boundary anchor missing');
 fs.writeFileSync(file,source.replace(early+guard,guard+early));
}
