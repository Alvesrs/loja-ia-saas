const fs=require('node:fs');
const cp=require('node:child_process');
fs.copyFileSync('patches/assets/cliente-interface-v2.css','public/css/cliente-interface-v2.css');
fs.copyFileSync('patches/assets/cliente-dashboard-v2.js','public/js/cliente-dashboard-v2.js');
for(const name of ['cliente-central.html','cliente-configuracao.html','cliente-produtos.html','cliente-estoque.html','cliente-agenda.html','cliente-whatsapp.html','cliente-plano.html']){
 const path='public/'+name;let html=fs.readFileSync(path,'utf8');
 if(!html.includes('css/cliente-interface-v2.css'))html=html.replace('</head>','<link rel="stylesheet" href="css/cliente-interface-v2.css?v=2026.10.04.2"></head>');
 if(name==='cliente-central.html'){
  html=html.replace('<script src="js/cliente-dashboard-polish-v3.js"></script><script src="js/cliente-dashboard-financeiro-v1.js"></script>','<script src="js/cliente-dashboard-v2.js?v=2026.10.04.2"></script>');
  html=html.replace(/async function carregarHomeNegocio\(\)\{[\s\S]*?(?=function onboardingDestino)/,'async function carregarHomeNegocio(){}\n').replace(/async function carregarOnboarding\(\)\{[\s\S]*?(?=function saintsUi)/,'async function carregarOnboarding(){}\n');
  html=html.replace('SaintsAI Dashboard','SaintsAI Cliente').replace('<link rel="stylesheet" href="css/cliente-dashboard-polish-v3.css">','').replace('<link rel="stylesheet" href="css/cliente-dashboard-financeiro-v1.css">','');
  if(!html.includes('id="sa-date"'))html=html.replace('<section id="inicio" class="section active">','<section id="inicio" class="section active"><div class="sa-welcome"><div><span class="sa-eyebrow">SEU NEGÓCIO, EM DIA</span><h1>Visão geral</h1><p id="sa-date"></p></div><a class="sa-new" href="cliente-agenda.html">+ Novo agendamento</a></div>');
  html=html.replace('js/cliente-atualizacao.js?v=2026.10.04.1','js/cliente-atualizacao.js?v=2026.10.04.2');
 }
 if(name==='cliente-configuracao.html')html=html.replace(/conecte o PagBank/g,'conecte o Asaas').replace(/Conecte o PagBank/g,'Conecte o Asaas').replace(/pagamentos via PagBank/g,'pagamentos via Asaas');
 if(name==='cliente-configuracao.html')html=html.replace("nome:'Itens/Serviços',titulo:'Itens e serviços',desc:'Cadastre livremente o que você vende ou agenda, com nome, preço e detalhes.'","nome:'Serviços',titulo:'Serviços e atendimentos',desc:'Cadastre serviços com preço, duração e fotos. Use Produtos para gerenciar o catálogo de mercadorias.'");
 if(name==='cliente-estoque.html'&&!html.includes('sa-back-home'))html=html.replace('<body>','<body><a class="sa-back-home" style="margin:12px 20px" href="cliente-central.html">← Visão geral</a>');
 fs.writeFileSync(path,html);
}
fs.writeFileSync('public/cliente-versao.json',JSON.stringify({versao:'2026.10.04.2',publicado_em:'2026-10-04',novidades:['Nova interface do cliente','Navegação com produtos, serviços e agenda','Resumo financeiro e conexões','Menos consultas duplicadas']})+'\n');
cp.execFileSync(process.execPath,['--check','public/js/cliente-dashboard-v2.js'],{stdio:'inherit'});
console.log('[cliente-interface-v2] interface responsiva e dashboard unificado.');
