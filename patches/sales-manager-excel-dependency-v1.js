const {execSync}=require('node:child_process');
console.log('Instalando dependência de exportação Excel...');
execSync('npm install --omit=dev --no-save exceljs@4.4.0',{stdio:'inherit'});
