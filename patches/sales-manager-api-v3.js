const fs=require('node:fs');
const p='src/app.js';
let s=fs.readFileSync(p,'utf8');

s=s.replace(/\n?\/\/ SALES_MANAGER_API_V2\napp\.use\('\/api\/gv', require\('\.\/routes\/sales-manager\.routes'\)\);\n?/g,'\n');

const marker='// SALES_MANAGER_API_V3';
if(!s.includes(marker)){
  const m=s.match(/app\.use\(express\.json\([^\n]*\);?/);
  if(!m) throw new Error('express.json não encontrado');
  const idx=m.index+m[0].length;
  const block="\n"+marker+"\napp.use('/api/gv', require('./routes/sales-manager.routes'));\n";
  s=s.slice(0,idx)+block+s.slice(idx);
}
fs.writeFileSync(p,s);
console.log('Sales Manager API V3 montada após express.json.');