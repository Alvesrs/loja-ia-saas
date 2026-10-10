const db=require('../config/supabase');
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function requested(t){t=norm(t);return /pix|picos|cobranca/.test(t)&&/ger|emit|cria|mand|envi|quero|faca|fazer/.test(t)&&/real|banco|reconhec|teste|testar|verificar|conferir|confirmar|centavo|notifica/.test(t);}
function amount(t){t=norm(t);if(/(?:um|1) centavo/.test(t))return 1;const m=/(?:r\$\s*|valor\s*(?:de\s*)?)(\d+(?:[.,]\d{1,2})?)/.exec(t)||/(\d+(?:[.,]\d{1,2})?)\s*(?:reais|real)/.exec(t);return m?Math.round(Number(m[1].replace(',','.'))*100):null;}
const reply=response=>({handled:true,response});
function show(p){return reply('Pix real para conferência — plano '+p.plano+' · '+new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(p.centavos/100)+'.\nVálido até '+new Date(p.expira).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+'. Este teste não ativa assinatura.\nCopie o código abaixo no banco para conferir o recebedor e o valor, sem confirmar o pagamento:\n'+p.payload);}
async function handle(args,c){
 if(!requested(args.pergunta))return null;
 if(!['554396431742@c.us','5543996431742@c.us','554396431742','5543996431742'].includes(args.contato))return reply('O Pix real de conferência está disponível apenas no número do dono autorizado. Para este contato, pagamentos continuam fictícios.');
 const b=c.briefing||{},old=b.__lab_real_pix,explicit=amount(args.pergunta);
 if(old?.payload&&Date.parse(old.expira)>Date.now()&&(explicit===null||explicit===old.centavos)&&!old.pago_em)return show(old);
 if(b.__lab_real_pix_status==='creating'||b.__lab_real_pix_status==='needs_review')return reply('A emissão deste Pix precisa ser conferida antes de uma nova tentativa, para evitar duplicidade.');
 const flow=require('./ownerSalesOnboarding.service'),t=norm(args.pergunta),plan=flow.available().find(p=>new RegExp('\\b'+p.codigo+'\\b').test(t))||flow.available().find(p=>p.codigo===b.__lab_plan);
 if(explicit!==null&&(!Number.isSafeInteger(explicit)||explicit<1))return reply('Informe um valor positivo em reais para o Pix.');
 const cents=explicit??plan?.precoMensalCentavos,label=explicit!==null?'Teste do dono':plan?.nome;
 if(!cents)return reply('Qual plano deseja conferir no banco: Básico, Pro ou Ilimitado? Peça, por exemplo, “gerar Pix real do Pro para testar no banco”.');
 const sub=require('./asaasSubconta.service');let key;
 try{const cfg=sub.cfg();key=cfg.ambiente==='production'&&String(cfg.rootKey||'').startsWith('$aact_prod_')?cfg.rootKey:await sub.obterApiKeyLoja(args.lojaId);if(!String(key).startsWith('$aact_prod_'))throw Error('not_production');}catch{return reply('Não encontrei uma chave Asaas de produção válida para gerar um Pix reconhecido pelo banco. Nenhum código de sandbox será apresentado como real.');}
 const lock=await db.from('saintsai_sales_conversations').update({briefing:{...b,__lab_real_pix_status:'creating'},atualizado_em:new Date().toISOString()}).eq('id',c.id).eq('atualizado_em',c.atualizado_em).select('id').maybeSingle();if(lock.error)throw lock.error;if(!lock.data)return reply('Seu Pix já está sendo preparado. Aguarde a resposta desta tentativa.');
 try{const keys=await sub.req('/v3/pix/addressKeys?status=ACTIVE&limit=20',{method:'GET'},key);const active=keys.data?.find(k=>k.status==='ACTIVE'&&k.key);if(!active)throw Error('no_active_key');
 const qr=await sub.req('/v3/pix/qrCodes/static',{method:'POST',body:{addressKey:active.key,description:'SaintsAI - teste de conferência '+label,value:cents/100,format:'PAYLOAD',expirationSeconds:900,allowsMultiplePayments:false,externalReference:'saintsai_lab:'+c.id}},key);
 if(!qr.id||!qr.payload)throw Error('invalid_qr');const p={provider_id:qr.id,payload:qr.payload,plano:label,centavos:cents,expira:new Date(Date.now()+900000).toISOString(),ambiente:'production'};
 const saved=await db.from('saintsai_sales_conversations').update({briefing:{...b,__lab_real_pix_status:'ready',__lab_real_pix:p},atualizado_em:new Date().toISOString()}).eq('id',c.id).eq('briefing->>__lab_real_pix_status','creating');if(saved.error)throw saved.error;return show(p);
 }catch(e){const rejected=e?.status===400,errors=Array.isArray(e?.body?.errors)?e.body.errors:[],codes=errors.map(x=>String(x.code||'').replace(/[^a-zA-Z0-9_]/g,'').slice(0,80)),detail=errors.map(x=>String(x.description||'')).filter(x=>/valor|value|minim|qr.?code|expiration|expiracao/i.test(x)&&! /token|api.?key|senha/i.test(x)).join(' ').slice(0,400);await db.from('saintsai_sales_conversations').update({briefing:{...b,__lab_real_pix_status:rejected?'rejected':'needs_review',__lab_real_pix_error:{status:e?.status||null,codes,detail}},atualizado_em:new Date().toISOString()}).eq('id',c.id);console.error('[lab.real-pix] falha_emissao',e?.status||e?.name||'Error',codes.join(','),detail);return reply(rejected?'O Asaas recusou a emissão deste Pix'+(detail?': '+detail:'. Código: '+codes.join(', '))+'. Nenhum Pix foi criado; o valor solicitado não foi alterado.':'O Asaas não confirmou a emissão do Pix. Não vou inventar um código nem repetir a cobrança automaticamente; o responsável precisa conferir esta tentativa.');}

}
module.exports={requested,amount,handle};
