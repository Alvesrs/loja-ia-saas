
const express=require('express');
const {exigirLogin}=require('../middleware/auth');
const c=require('../controllers/servicoImagem.controller');

const r=express.Router({mergeParams:true});
r.use(express.json({limit:'5mb'}));
r.use(exigirLogin);
r.post('/',c.upload);

module.exports=r;
