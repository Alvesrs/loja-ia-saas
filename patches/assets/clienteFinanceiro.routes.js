const express=require('express');
const {exigirLogin}=require('../middleware/auth');
const c=require('../controllers/clienteFinanceiro.controller');
const r=express.Router({mergeParams:true});
r.use(exigirLogin);
r.get('/',c.resumo);
module.exports=r;
