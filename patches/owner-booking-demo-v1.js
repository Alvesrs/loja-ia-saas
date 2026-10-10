const fs=require('node:fs');
fs.copyFileSync('patches/assets/owner-booking-demo.service.js','src/services/ownerBookingDemo.service.js');
fs.copyFileSync('patches/assets/owner-product-lab.service.js','src/services/ownerProductLab.service.js');
console.log('Demonstração: corte, horário, confirmação e pagamento por menus interativos.');
