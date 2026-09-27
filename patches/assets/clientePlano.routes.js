const express=require('express');
const {exigirLogin}=require('../middleware/auth');
const c=require('../controllers/clientePlano.controller');
const r=express.Router({mergeParams:true});
r.use(exigirLogin);
r.get('/',c.resumo);
r.post('/pix',c.gerarPix);
module.exports=r;
