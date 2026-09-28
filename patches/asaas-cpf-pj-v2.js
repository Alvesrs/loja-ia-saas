const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const os=require('node:os');

function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

let svc=read('src/services/asaasSubconta.service.js');
let lines=svc.split('\n');
let i=lines.findIndex(x=>x.includes("const name=limpar(d.name),email=limpar(d.email).toLowerCase(),cpfCnpj=digitos(d.cpfCnpj)"));
if(i<0)throw new Error('Bloco de dados Asaas v1 não encontrado');
lines.splice(i,5,
"  const name=limpar(d.name),email=limpar(d.email).toLowerCase(),cpfCnpj=digitos(d.cpfCnpj),mobilePhone=digitos(d.mobilePhone),address=limpar(d.address),addressNumber=limpar(d.addressNumber),province=limpar(d.province),postalCode=digitos(d.postalCode),incomeValue=Number(d.incomeValue||0),birthDateEntrada=limpar(d.birthDate),birthDate=/^\\d{2}\\/\\d{2}\\/\\d{4}$/.test(birthDateEntrada)?birthDateEntrada.split('/').reverse().join('-'):birthDateEntrada;",
"  const pessoaFisica=cpfCnpj.length===11,pessoaJuridica=cpfCnpj.length===14;",
"  const companyType=pessoaJuridica?limpar(d.companyType||'MEI'):'';",
"  const taxRegime=pessoaJuridica?limpar(d.taxRegime||(companyType==='MEI'?'MEI':'UNKNOWN')):'';",
"  if(!name||!email||(!pessoaFisica&&!pessoaJuridica)||mobilePhone.length<10||!address||!addressNumber||!province||postalCode.length!==8||!Number.isFinite(incomeValue)||incomeValue<=0)throw new Error('dados_subconta_invalidos');",
"  if(pessoaFisica&&!/^\\d{4}-\\d{2}-\\d{2}$/.test(birthDate))throw new Error('nascimento_invalido');",
"  if(pessoaJuridica&&!['MEI','LIMITED','INDIVIDUAL','ASSOCIATION'].includes(companyType))throw new Error('tipo_empresa_invalido');",
"  if(pessoaJuridica&&!['MEI','NATIONAL_SIMPLE','NORMAL_REGIME','UNKNOWN'].includes(taxRegime))throw new Error('regime_invalido');"
);
i=lines.findIndex(x=>x.includes("const payload={name,email,loginEmail:email,cpfCnpj,companyType,taxRegime"));
if(i<0)throw new Error('Payload Asaas v1 não encontrado');
lines.splice(i,1,
"  const payload={name,email,loginEmail:email,cpfCnpj,mobilePhone,incomeValue,address,addressNumber,province,postalCode,complement:limpar(d.complement),site:limpar(d.site)||c.publicBase,webhooks:[{name:'SaintsAI pagamentos',url:c.publicBase+'/api/pagamentos/asaas/subconta/webhook',email,sendType:'SEQUENTIALLY',interrupted:false,enabled:true,apiVersion:3,authToken:webhookToken,events:['PAYMENT_CREATED','PAYMENT_UPDATED','PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_OVERDUE','PAYMENT_REFUNDED','PAYMENT_DELETED']}]};",
"  if(pessoaFisica)payload.birthDate=birthDate;else{payload.companyType=companyType;payload.taxRegime=taxRegime;}"
);
svc=lines.join('\n');
write('src/services/asaasSubconta.service.js',svc);

let ctl=read('src/controllers/asaasSubconta.controller.js');
const oldCtl="if(['dados_subconta_invalidos','tipo_empresa_invalido','regime_invalido'].includes(e.message))return res.status(400).json({erro:'Confira CNPJ, telefone, faturamento e endereço antes de continuar.'});";
const newCtl="if(['dados_subconta_invalidos','tipo_empresa_invalido','regime_invalido','nascimento_invalido'].includes(e.message))return res.status(400).json({erro:e.message==='nascimento_invalido'?'Informe a data de nascimento no formato DD/MM/AAAA.':'Confira CPF/CNPJ, telefone, renda/faturamento e endereço antes de continuar.'});";
if(!ctl.includes(oldCtl))throw new Error('Erro de validação antigo não encontrado');
ctl=ctl.replace(oldCtl,newCtl);
write('src/controllers/asaasSubconta.controller.js',ctl);

let html=read('public/cliente-configuracao.html');
const oldFields='<div class="row"><div class="field"><label>CNPJ</label><input id="a-cnpj" inputmode="numeric"></div><div class="field"><label>Tipo da empresa</label><select id="a-type"><option value="MEI">MEI</option><option value="LIMITED">LTDA</option><option value="INDIVIDUAL">Empresário individual</option><option value="ASSOCIATION">Associação</option></select></div></div><div class="row"><div class="field"><label>Celular</label><input id="a-phone" inputmode="tel"></div><div class="field"><label>Faturamento mensal</label><input id="a-income" type="number" min="1" step="0.01"></div></div>';
const newFields='<div class="row"><div class="field"><label>Tipo de titular</label><select id="a-person"><option value="FISICA">Pessoa Física (CPF)</option><option value="JURIDICA">Pessoa Jurídica (CNPJ)</option></select></div><div class="field"><label id="a-doc-label">CPF</label><input id="a-doc" inputmode="numeric" maxlength="18" placeholder="Somente números"></div></div><div class="row" id="a-pf-row"><div class="field"><label>Data de nascimento</label><input id="a-birth" type="text" inputmode="numeric" maxlength="10" placeholder="DD/MM/AAAA" autocomplete="bday"></div></div><div class="row" id="a-pj-row"><div class="field"><label>Tipo da empresa</label><select id="a-type"><option value="MEI">MEI</option><option value="LIMITED">LTDA</option><option value="INDIVIDUAL">Empresário individual</option><option value="ASSOCIATION">Associação</option></select></div></div><div class="row"><div class="field"><label>Celular</label><input id="a-phone" inputmode="tel"></div><div class="field"><label id="a-income-label">Renda mensal</label><input id="a-income" type="number" min="1" step="0.01"></div></div>';
if(!html.includes(oldFields))throw new Error('Campos CNPJ da UI v1 não encontrados');
html=html.replace(oldFields,newFields);

const oldInit="$('p-din').checked=!!p.aceita_dinheiro;$('p-pixp').checked=!!p.aceita_pix_presencial;$('p-cart').checked=!!p.aceita_cartao_presencial;$('p-pixo').checked=!!p.aceita_pix_online;$('p-antec').checked=!!p.exige_pagamento_antecipado;$('p-sinal-t').value=p.sinal_tipo||'nenhum';$('p-sinal-v').value=Number(p.sinal_valor||0);";
const newInit=oldInit+"\n const sincronizarTitularAsaas=()=>{const pf=$('a-person').value==='FISICA';$('a-pf-row').style.display=pf?'grid':'none';$('a-pj-row').style.display=pf?'none':'grid';$('a-doc-label').textContent=pf?'CPF':'CNPJ';$('a-income-label').textContent=pf?'Renda mensal':'Faturamento mensal';};$('a-person').onchange=sincronizarTitularAsaas;sincronizarTitularAsaas();const nascimento=$('a-birth');nascimento.oninput=()=>{let v=nascimento.value.replace(/\\D/g,'').slice(0,8);if(v.length>4)v=v.slice(0,2)+'/'+v.slice(2,4)+'/'+v.slice(4);else if(v.length>2)v=v.slice(0,2)+'/'+v.slice(2);nascimento.value=v;};";
if(!html.includes(oldInit))throw new Error('Inicialização da UI Asaas não encontrada');
html=html.replace(oldInit,newInit);

const oldSubmit="const body={name:$('a-name').value,email:$('a-email').value,cpfCnpj:$('a-cnpj').value,companyType:$('a-type').value,taxRegime:$('a-type').value==='MEI'?'MEI':'UNKNOWN',mobilePhone:$('a-phone').value,incomeValue:Number($('a-income').value||0),postalCode:$('a-cep').value,address:$('a-address').value,addressNumber:$('a-number').value,province:$('a-province').value,complement:$('a-complement').value};";
const newSubmit="const pf=$('a-person').value==='FISICA';const body={name:$('a-name').value,email:$('a-email').value,cpfCnpj:$('a-doc').value,birthDate:pf?$('a-birth').value:undefined,companyType:pf?undefined:$('a-type').value,taxRegime:pf?undefined:($('a-type').value==='MEI'?'MEI':'UNKNOWN'),mobilePhone:$('a-phone').value,incomeValue:Number($('a-income').value||0),postalCode:$('a-cep').value,address:$('a-address').value,addressNumber:$('a-number').value,province:$('a-province').value,complement:$('a-complement').value};";
if(!html.includes(oldSubmit))throw new Error('Submit Asaas v1 não encontrado');
html=html.replace(oldSubmit,newSubmit);
html=html.replace('Asaas disponível. Preencha os dados reais da empresa para ativar.','Asaas disponível. Escolha Pessoa Física ou Pessoa Jurídica e preencha os dados reais do titular.');
write('public/cliente-configuracao.html',html);

cp.execFileSync(process.execPath,['--check','src/services/asaasSubconta.service.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','src/controllers/asaasSubconta.controller.js'],{stdio:'inherit'});
const out=read('public/cliente-configuracao.html');
const re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;let m,n=0;
while((m=re.exec(out))){const code=m[1].trim();if(!code)continue;const tmp=path.join(os.tmpdir(),'saintsai-asaas-cpf-pj-'+(++n)+'.js');fs.writeFileSync(tmp,code);try{cp.execFileSync(process.execPath,['--check',tmp],{stdio:'inherit'});}finally{try{fs.unlinkSync(tmp)}catch(_){}}}
if(!out.includes('Pessoa Física (CPF)'))throw new Error('UI sem opção CPF');
if(!out.includes('Pessoa Jurídica (CNPJ)'))throw new Error('UI sem opção CNPJ');
if(!svc.includes('pessoaFisica=cpfCnpj.length===11'))throw new Error('Backend sem CPF');
if(!svc.includes('payload.birthDate=birthDate'))throw new Error('Backend sem birthDate PF');
console.log('[asaas-cpf-pj-v2] PASS CPF e CNPJ suportados no onboarding Asaas.');