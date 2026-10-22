import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {createGateway} from './index.mjs';
const gateway=createGateway(process.env),limit=13*1024*1024;
const server=createServer(async(req,res)=>{
 try{
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>limit){res.writeHead(413,{'Content-Type':'text/plain'});res.end('Requisição acima do limite.');return;}chunks.push(chunk);}
  const headers=new Headers();for(const [name,value] of Object.entries(req.headers)){if(Array.isArray(value))for(const v of value)headers.append(name,v);else if(value!==undefined)headers.set(name,value);}
  const origin=process.env.PUBLIC_BASE_URL||'http://localhost:'+String(process.env.PORT||3000);
  const request=new Request(new URL(req.url,origin),{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await gateway(request);res.statusCode=response.status;
  for(const [name,value] of response.headers)if(name!=='set-cookie')res.setHeader(name,value);
  const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);
  if(req.method==='HEAD'||!response.body){res.end();return;}
  Readable.fromWeb(response.body).on('error',()=>res.destroy()).pipe(res);
 }catch{if(!res.headersSent)res.writeHead(502,{'Content-Type':'text/plain'});res.end('Não foi possível confirmar a operação.');}
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Entrada Órbita iniciada.'));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
