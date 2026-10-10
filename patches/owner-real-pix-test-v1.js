const fs=require('node:fs');
fs.copyFileSync('patches/assets/owner-real-pix-test.service.js','src/services/ownerRealPixTest.service.js');
fs.copyFileSync('patches/assets/owner-product-lab.service.js','src/services/ownerProductLab.service.js');
console.log('Pix de conferência real restrito ao dono, sem ativação de plano.');
