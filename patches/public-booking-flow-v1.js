const fs=require('node:fs');
const cp=require('node:child_process');
const os=require('node:os');
const path=require('node:path');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

fs.mkdirSync('src/services',{recursive:true});
fs.mkdirSync('src/controllers',{recursive:true});
fs.mkdirSync('src/routes',{recursive:true});
fs.mkdirSync('public',{recursive:true});
fs.copyFileSync('patches/assets/bookingPublic.service.js','src/services/bookingPublic.service.js');
fs.copyFileSync('patches/assets/bookingPublic.controller.js','src/controllers/bookingPublic.controller.js');
fs.copyFileSync('patches/assets/bookingPublic.routes.js','src/routes/bookingPublic.routes.js');
fs.copyFileSync('patches/assets/agendar-public.html','public/agendar.html');

let app=read('src/app.js');
if(!app.includes("const bookingPublicRoutes=require('./routes/bookingPublic.routes');")){
  const anchor="const express = require('express');";
  if(!app.includes(anchor))throw new Error('Express require não encontrado');
  app=app.replace(anchor,anchor+"\nconst bookingPublicRoutes=require('./routes/bookingPublic.routes');");
}
if(!app.includes("app.use('/api/public/agenda', bookingPublicRoutes);")){
  const anchor="app.use('/api/public/compra-saintsai', compraPublicaRoutes);";
  if(!app.includes(anchor))throw new Error('Rota pública de compra não encontrada');
  app=app.replace(anchor,anchor+"\napp.use('/api/public/agenda', bookingPublicRoutes);\napp.get('/agendar/:token',(_req,res)=>{res.set('Cache-Control','no-store, no-cache, must-revalidate');return res.sendFile(require('node:path').join(process.cwd(),'public','agendar.html'));});");
}
write('src/app.js',app);

let agenda=read('src/services/agendaWhatsapp.service.js');
if(!agenda.includes("const bookingPublic=require('./bookingPublic.service');")){
  const anchor="const llm=require('./llm.service');";
  if(!agenda.includes(anchor))throw new Error('Require LLM da agenda não encontrado');
  agenda=agenda.replace(anchor,anchor+"\nconst bookingPublic=require('./bookingPublic.service');");
}
if(!agenda.includes('link_publico')){
  const anchor="  if(!ativo)estado={ativo:true};";
  if(!agenda.includes(anchor))throw new Error('Início do fluxo de agenda não encontrado');
  const bloco=[
    "  if(!ativo){",
    "    try{",
    "      const linkPublico=await bookingPublic.criarLink({lojaId,contato,clienteNome:estado?.nome||null});",
    "      estado={...estado,ativo:true,link_publico:linkPublico};",
    "      await salvarEstado(lojaId,contato,estado);",
    "      return 'Claro. Para escolher serviço, preço, dia e horário tocando nas opções, use este link: '+linkPublico+'\\nSe preferir, você também pode continuar o agendamento por mensagem aqui.';",
    "    }catch(_){ }",
    "  }"
  ].join('\n');
  agenda=agenda.replace(anchor,bloco+"\n"+anchor);
}
write('src/services/agendaWhatsapp.service.js',agenda);

for(const p of [
  'src/services/bookingPublic.service.js',
  'src/controllers/bookingPublic.controller.js',
  'src/routes/bookingPublic.routes.js',
  'src/services/agendaWhatsapp.service.js',
  'src/app.js'
]) cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});

const html=read('public/agendar.html');
const re=/<script>([\s\S]*?)<\/script>/g;let m,n=0;
while((m=re.exec(html))){const code=m[1].trim();if(!code)continue;const tmp=path.join(os.tmpdir(),'saintsai-agendar-'+(++n)+'.js');fs.writeFileSync(tmp,code);try{cp.execFileSync(process.execPath,['--check',tmp],{stdio:'inherit'});}finally{try{fs.unlinkSync(tmp)}catch(_){}}}
if(!n)throw new Error('Página pública sem JavaScript');
console.log('Agendamento clicável por link conectado ao WhatsApp.');