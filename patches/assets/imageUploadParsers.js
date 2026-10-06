const express=require('express');
const {exigirLogin}=require('../middleware/auth');
const {exigirDonoDaLoja}=require('../middleware/lojaOwnership');
// Deve ser montado antes do parser geral. 3 MB de foto viram ~4 MB em base64.
module.exports=function mountImageUploadParsers(app){
 for(const type of ['servico-imagem','produto-imagem']){
  app.use('/api/lojas/:lojaId/'+type,exigirLogin,exigirDonoDaLoja,express.json({limit:'5mb'}));
 }
};
