const db=require('../config/supabase');
const phones=new Set(['554396431742@c.us','5543996431742@c.us','554396431742','5543996431742']);
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const checked=async r=>{if(r.error)throw r.error;return r.data;};
const reply=(response,interativo)=>({handled:true,response,...(interativo?{interativo}:{})});
function plans(flow){return flow.available().map(p=>({...p,precoMensalCentavos:1}));}
function menu(flow){return require('./acoesWhatsapp.service').escolhas(plans(flow).map(p=>({value:'testeplano:'+p.codigo,title:p.nome,description:'R$ 0,01 · '+flow.quota(p),forceList:true})));}
async function handle(args,c){
 if(!phones.has(args.contato)||c.briefing?.__lab_subscription_test!==true)return null;
 const store=await checked(await db.from('lojas').select('dono_id').eq('id',args.lojaId).maybeSingle());if(!process.env.SAINTSAI_OWNER_USER_ID||store?.dono_id!==process.env.SAINTSAI_OWNER_USER_ID)return null;
 const flow=require('./ownerSalesOnboarding.service'),t=norm(args.pergunta);let row=await checked(await db.from('saintsai_sales_onboarding').select('*').eq('conversa_id',c.id).eq('owner_store_id',args.lojaId).maybeSingle());
 const paymentRequest=/\bpix\b|\bpagamento\b|(?:1|um) centavo|0[,.]01/.test(t);
 const start=/contrat.*teste|cliente.*teste|atualiz.*plano|mudar.*plano|trocar.*plano|\bcomprar\b|\bcontratar\b/.test(t),b=c.briefing;
 const requested=plans(flow).find(p=>t==='testeplano:'+p.codigo||t===p.codigo||t===norm(p.nome)||t==='plano '+p.codigo);
 if(!start&&!requested&&!paymentRequest&&!b.__lab_subscription_select&&!/^(pix|gerar pix|paguei|pagamento|meu plano|acesso|baixar|baixar app)$/.test(t))return null;
 if(row?.phase==='awaiting_payment'){
  if(await flow.paid(row)){row=await checked(await db.from('saintsai_sales_onboarding').update({phase:'active',updated_at:new Date().toISOString()}).eq('id',row.id).eq('phase','awaiting_payment').select('*').maybeSingle())||row;}
  else if(paymentRequest||start)return reply(flow.paymentText(row));
  else return reply('A contratação ainda aguarda a confirmação do Asaas. Não será criada outra cobrança enquanto este pagamento estiver pendente. Peça “pagamento” para conferir o Pix.');
 }
 if(row&&['creating','charging','needs_owner'].includes(row.phase))return reply('Esta contratação está em preparação ou revisão. Não vou repetir o cadastro nem a cobrança.');
 if(start||(!row&&!requested)){
  await checked(await db.from('saintsai_sales_conversations').update({briefing:{...b,__lab_subscription_select:true},atualizado_em:new Date().toISOString()}).eq('id',c.id));
  return reply('Contratação real de teste: escolha seu plano. Cada opção custa R$ 0,01 por mês nesta conta de teste. A ativação acontece após pagar o Pix; não há renovação automática.',menu(flow));
 }
 if(requested&&(b.__lab_subscription_select||!row||row.phase==='offer')){
  if(!row)row=await checked(await db.from('saintsai_sales_onboarding').insert({conversa_id:c.id,owner_store_id:args.lojaId,phase:'offer'}).select('*').single());
  if(!row.customer_store_id){const response=await flow.provision(row,c,requested);row=await checked(await db.from('saintsai_sales_onboarding').select('*').eq('id',row.id).maybeSingle());if(!row?.customer_store_id||row.phase!=='payment_method')return reply(response);}
  else {row=await checked(await db.from('saintsai_sales_onboarding').update({plan:requested.codigo,phase:'payment_method',payment:null,due_at:null,updated_at:new Date().toISOString()}).eq('id',row.id).eq('phase',row.phase).select('*').maybeSingle());if(!row)return reply('Sua seleção já está sendo preparada. Aguarde.');}
  await require('./condicoesComerciais.service').salvar(row.customer_store_id,{tipo:'personalizado',plano:requested.codigo,preco_mensal_centavos:1},store.dono_id);
  await checked(await db.from('saintsai_sales_conversations').update({briefing:{...b,__lab_subscription_select:false},atualizado_em:new Date().toISOString()}).eq('id',c.id));
  return reply('Plano '+requested.nome+' selecionado por R$ 0,01. O plano no app só muda depois da confirmação do pagamento.',require('./acoesWhatsapp.service').escolhas([{title:'Pagar R$ 0,01',value:'pix'}]));
 }
 if(row?.phase==='payment_method'){
  if(paymentRequest)return reply(await flow.charge(row,'pix'));
  return reply('Seu plano selecionado aguarda o Pix de R$ 0,01.',require('./acoesWhatsapp.service').escolhas([{title:'Pagar R$ 0,01',value:'pix'}]));
 }
 if(row?.phase==='active')return reply('Seu plano '+(flow.available().find(p=>p.codigo===row.plan)?.nome||row.plan)+' está ativo.\n'+await flow.access(row)+'\nPara mudar, diga “atualizar meu plano”.');
 return reply('Diga “iniciar contratação de teste” para escolher seu plano.',menu(flow));
}
module.exports={handle,plans};
