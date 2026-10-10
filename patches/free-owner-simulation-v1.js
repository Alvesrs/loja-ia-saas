const fs=require('node:fs');
fs.copyFileSync('patches/assets/owner-free-simulation.service.js','src/services/ownerFreeSimulation.service.js');
fs.copyFileSync('patches/assets/owner-product-lab.service.js','src/services/ownerProductLab.service.js');
console.log('Simulação por instruções naturais habilitada apenas após validação do laboratório privado.');
fs.copyFileSync('patches/assets/owner-sales-onboarding.service.js','src/services/ownerSalesOnboarding.service.js');
