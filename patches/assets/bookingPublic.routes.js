const express=require('express');
const c=require('../controllers/bookingPublic.controller');
const r=express.Router();
r.get('/:token',c.resumo);
r.get('/:token/disponibilidade',c.disponibilidade);
r.post('/:token/confirmar',c.confirmar);
r.get('/:token/status',c.status);
module.exports=r;
