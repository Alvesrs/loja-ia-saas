
const { criarPedidoDeEnvio, criarResultadoEnvio, criarResultadoFalha, STATUS_ENVIO, CODIGOS_ERRO_ENVIO } = require('./contrato');
const { ehStringNaoVazia } = require('../../../utils/validacao');

const NOME_DO_ADAPTADOR = 'waha';
const TIMEOUT_PADRAO_MS = 15000;

function configAmbiente() {
  const timeout = Number(process.env.WAHA_TIMEOUT_MS);
  return {
    baseUrl: ehStringNaoVazia(process.env.WAHA_BASE_URL) ? process.env.WAHA_BASE_URL.replace(/\/+$/, '') : null,
    apiKey: process.env.WAHA_API_KEY,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : TIMEOUT_PADRAO_MS,
  };
}

function chatIdDoContato(contato) {
  const valor = String(contato || '').trim();
  if (valor.includes('@')) return valor;
  const digitos = valor.replace(/\D/g, '');
  return digitos ? digitos + '@c.us' : '';
}

function extrairId(dados) {
  const candidatos = [
    dados && dados.id,
    dados && dados.key && dados.key.id,
    dados && dados._data && dados._data.id && (dados._data.id.id || dados._data.id._serialized),
  ];
  return candidatos.find(ehStringNaoVazia) || null;
}

function criarAdaptadorWaha(opcoes = {}) {
  const env = configAmbiente();
  const baseUrl = ehStringNaoVazia(opcoes.baseUrl) ? opcoes.baseUrl.replace(/\/+$/, '') : env.baseUrl;
  const apiKey = ehStringNaoVazia(opcoes.apiKey) ? opcoes.apiKey : env.apiKey;
  const session = ehStringNaoVazia(opcoes.session) ? opcoes.session.trim() : null;
  const timeoutMs = Number.isFinite(opcoes.timeoutMs) && opcoes.timeoutMs > 0 ? opcoes.timeoutMs : env.timeoutMs;
  const fetchFn = typeof opcoes.fetchFn === 'function' ? opcoes.fetchFn : global.fetch;

  return Object.freeze({
    nome: NOME_DO_ADAPTADOR,
    async enviarMensagem(entrada) {
      const pedido = criarPedidoDeEnvio(entrada);
      if (!ehStringNaoVazia(baseUrl) || !ehStringNaoVazia(apiKey) || !ehStringNaoVazia(session) || typeof fetchFn !== 'function') {
        return criarResultadoFalha({ provedor: NOME_DO_ADAPTADOR, codigoErro: CODIGOS_ERRO_ENVIO.erroInterno });
      }
      const chatId = chatIdDoContato(pedido.contato);
      if (!chatId) return criarResultadoFalha({ provedor: NOME_DO_ADAPTADOR, codigoErro: CODIGOS_ERRO_ENVIO.mensagemRejeitada });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        if(['button','list'].includes(pedido.interativo?.type)){
          const options=pedido.interativo.type==='button'?pedido.interativo.action.buttons.map(b=>({title:b.reply.title,id:b.reply.id})):pedido.interativo.action.sections[0].rows;
          const buttons=await fetchFn(baseUrl+'/api/sendList',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','X-Api-Key':apiKey},body:JSON.stringify({session,chatId,message:{title:'Escolha uma opção',description:pedido.texto,button:'Escolher opção',sections:[{title:'Opções',rows:options.map(b=>({title:b.title,rowId:require('../../mensagemInterativa.service').lerId(b.id),description:b.description||null}))}]}}),signal:controller.signal});
          let receipt=null;try{receipt=await buttons.json();}catch{}
          if(buttons.ok)return criarResultadoEnvio({provedor:NOME_DO_ADAPTADOR,status:STATUS_ENVIO.enviado,idExterno:extrairId(receipt)});
          // Only a definite unsupported/rejected format permits a text menu fallback.
          // Timeout, rate limit and server errors remain failures; never send twice after ambiguity.
          if(![400,404,422,501].includes(buttons.status))return criarResultadoFalha({provedor:NOME_DO_ADAPTADOR,codigoErro:CODIGOS_ERRO_ENVIO.provedorIndisponivel});
          console.log('[waha.buttons] formato_indisponivel_menu_texto',buttons.status);
        }
        const resp = await fetchFn(baseUrl + (pedido.videoUrl ? '/api/sendVideo' : pedido.imagemUrl ? '/api/sendImage' : '/api/sendText'), {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
          },
          body: JSON.stringify(pedido.videoUrl ? {session,chatId,file:{url:pedido.videoUrl,filename:'video.mp4',mimetype:'video/mp4'},caption:pedido.texto.slice(0,1024),asNote:false,convert:true} : pedido.imagemUrl ? {
            session, chatId, file: { url: pedido.imagemUrl, filename: new URL(pedido.imagemUrl).pathname.split('/').pop(), mimetype: /\.png$/i.test(pedido.imagemUrl) ? 'image/png' : /\.webp$/i.test(pedido.imagemUrl) ? 'image/webp' : 'image/jpeg' }, caption: pedido.texto.slice(0, 1024)
          } : { session, chatId, text: pedido.texto }),
          signal: controller.signal,
        });
        let dados = null;
        try { dados = await resp.json(); } catch (_) {}
        if (!resp.ok) {
          const codigo = resp.status === 429 || resp.status >= 500
            ? CODIGOS_ERRO_ENVIO.provedorIndisponivel
            : CODIGOS_ERRO_ENVIO.mensagemRejeitada;
          return criarResultadoFalha({ provedor: NOME_DO_ADAPTADOR, codigoErro: codigo });
        }
        return criarResultadoEnvio({
          provedor: NOME_DO_ADAPTADOR,
          status: STATUS_ENVIO.enviado,
          idExterno: extrairId(dados),
        });
      } catch (_) {
        return criarResultadoFalha({ provedor: NOME_DO_ADAPTADOR, codigoErro: CODIGOS_ERRO_ENVIO.provedorIndisponivel });
      } finally {
        clearTimeout(timer);
      }
    },
    normalizarMensagemRecebida(entrada) { return entrada; },
    identificarContato(m) { return m && m.contato || null; },
    identificarLoja(m) { return m && m.lojaId || null; },
  });
}

module.exports = { criarAdaptadorWaha, NOME_DO_ADAPTADOR, chatIdDoContato, extrairId };
