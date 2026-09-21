const fs = require('node:fs');

function replaceOnce(path, from, to) {
  let src = fs.readFileSync(path, 'utf8');
  if (!src.includes(from)) throw new Error('Trecho esperado não encontrado em ' + path);
  src = src.replace(from, to);
  fs.writeFileSync(path, src);
}

replaceOnce(
  'src/controllers/pedidos.controller.js',
  [
    "const ERROS_RPC_PEDIDO = {",
    "  CLIENTE_INVALIDO: { status: 400, mensagem: 'O cliente informado não pertence a esta loja.' },",
    "  ITENS_VAZIOS: { status: 400, mensagem: 'Informe ao menos um item no pedido.' },",
    "  QUANTIDADE_INVALIDA: { status: 400, mensagem: 'Quantidade inválida em um dos itens do pedido.' },",
    "  ITEM_INVALIDO: { status: 400, mensagem: 'Um dos itens do pedido não pertence a esta loja.' },",
    "  ESTOQUE_INSUFICIENTE: { status: 409, mensagem: 'Estoque insuficiente para um dos itens do pedido.' },",
    "};"
  ].join('\n'),
  [
    "const ERROS_RPC_PEDIDO = {",
    "  CLIENTE_INVALIDO: { status: 400, mensagem: 'O cliente informado não pertence a esta loja.' },",
    "  ITENS_VAZIOS: { status: 400, mensagem: 'Informe ao menos um item no pedido.' },",
    "  QUANTIDADE_INVALIDA: { status: 400, mensagem: 'Quantidade inválida em um dos itens do pedido.' },",
    "  ITEM_INVALIDO: { status: 400, mensagem: 'Um dos itens do pedido não pertence a esta loja.' },",
    "  ESTOQUE_INSUFICIENTE: { status: 409, mensagem: 'Estoque insuficiente para um dos itens do pedido.' },",
    "};",
    "",
    "const ERROS_RPC_STATUS_PEDIDO = {",
    "  STATUS_INVALIDO: { status: 400, mensagem: 'Status de pedido inválido.' },",
    "  PEDIDO_NAO_ENCONTRADO: { status: 404, mensagem: 'Pedido não encontrado nesta loja.' },",
    "  TRANSICAO_INVALIDA: { status: 409, mensagem: 'Esta mudança de status não é permitida.' },",
    "  STATUS_FINAL: { status: 409, mensagem: 'Este pedido já está em um status final.' },",
    "  ESTOQUE_NAO_ENCONTRADO: { status: 409, mensagem: 'Não foi possível repor o estoque deste pedido.' },",
    "};"
  ].join('\n')
);

replaceOnce(
  'src/controllers/pedidos.controller.js',
  "module.exports = { criarPedido, listarPedidos };",
  [
    "async function atualizarStatusPedido(req, res) {",
    "  const { lojaId, pedidoId } = req.params;",
    "  const { status } = req.body || {};",
    "",
    "  if (!ehUuid(pedidoId)) {",
    "    return res.status(400).json({ erro: 'Identificador de pedido inválido.' });",
    "  }",
    "",
    "  if (typeof status !== 'string' || !['confirmado', 'cancelado', 'entregue'].includes(status)) {",
    "    return res.status(400).json({ erro: 'Informe um status válido: confirmado, cancelado ou entregue.' });",
    "  }",
    "",
    "  const { data, error } = await supabase.rpc('atualizar_status_pedido', {",
    "    p_loja_id: lojaId,",
    "    p_pedido_id: pedidoId,",
    "    p_novo_status: status,",
    "  });",
    "",
    "  if (error) {",
    "    const erroConhecido = ERROS_RPC_STATUS_PEDIDO[error.message];",
    "    if (erroConhecido) {",
    "      return res.status(erroConhecido.status).json({ erro: erroConhecido.mensagem });",
    "    }",
    "    return tratarErroBanco(res, error);",
    "  }",
    "",
    "  return res.json(data);",
    "}",
    "",
    "module.exports = { criarPedido, listarPedidos, atualizarStatusPedido };"
  ].join('\n')
);

replaceOnce(
  'src/routes/pedidos.routes.js',
  "const { criarPedido, listarPedidos } = require('../controllers/pedidos.controller');",
  "const { criarPedido, listarPedidos, atualizarStatusPedido } = require('../controllers/pedidos.controller');"
);

replaceOnce(
  'src/routes/pedidos.routes.js',
  "router.get('/', listarPedidos);",
  "router.get('/', listarPedidos);\nrouter.patch('/:pedidoId/status', atualizarStatusPedido);"
);

const pedidosPath = 'public/js/pedidos.js';
let pedidosSrc = fs.readFileSync(pedidosPath, 'utf8');
const inicio = pedidosSrc.indexOf('function abrirDetalhesPedido(pedido) {');
const fimMarcador = '\n// ---------- Criar pedido ----------';
const fim = pedidosSrc.indexOf(fimMarcador, inicio);
if (inicio < 0 || fim < 0) throw new Error('Bloco de detalhes do pedido não encontrado.');
const novoBloco = [
  "function transicoesDisponiveis(status) {",
  "  if (status === 'pendente') return ['confirmado', 'cancelado'];",
  "  if (status === 'confirmado') return ['entregue', 'cancelado'];",
  "  return [];",
  "}",
  "",
  "function abrirDetalhesPedido(pedido) {",
  "  const itens = itensDoPedido(pedido);",
  "  const cliente = nomeCliente(pedido);",
  "  const transicoes = transicoesDisponiveis(pedido.status);",
  "",
  "  const opcoesStatus = transicoes.map((status) => '<option value=\"' + status + '\">' + STATUS_INFO[status].label + '</option>').join('');",
  "  const controleStatus = transicoes.length > 0 ? '<div class=\"field\" style=\"margin-top:20px;\"><label for=\"campo-status-pedido\">Alterar status</label><select id=\"campo-status-pedido\"><option value=\"\">Selecione o novo status</option>' + opcoesStatus + '</select></div><div id=\"erro-status-pedido\" class=\"error-msg hidden\" role=\"alert\"></div>' : '<p class=\"aviso-em-breve\" style=\"margin-top:20px;\">Este pedido está em um status final.</p>';",
  "  const botaoStatus = transicoes.length > 0 ? '<button type=\"button\" class=\"btn-primary small\" id=\"botao-salvar-status\">Salvar status</button>' : '';",
  "",
  "  const html = '<h2>Pedido ' + numeroCurto(pedido) + '</h2>' +",
  "    '<p>' + formatarData(pedido.criado_em) + ' · ' + badgeStatus(pedido.status) + '</p>' +",
  "    '<div class=\"pedido-detalhes\"><dl><dt>Cliente</dt><dd>' + (cliente ? escaparHtml(cliente) : 'Sem cliente vinculado') + '</dd></dl>' +",
  "    (itens.length > 0 ? '<table class=\"pedido-detalhe-tabela\"><thead><tr><th>Produto</th><th>Qtd.</th><th>Preço un.</th><th>Subtotal</th></tr></thead><tbody>' + itens.map(renderizarItemDetalhe).join('') + '</tbody></table>' : '<p>Nenhum item encontrado para este pedido.</p>') +",
  "    '<div class=\"pedido-detalhe-total\"><span>Total</span><strong>' + formatarPrecoBRL(pedido.total) + '</strong></div>' + controleStatus + '</div>' +",
  "    '<div class=\"modal-actions\"><button type=\"button\" class=\"btn-secondary\" id=\"botao-fechar-detalhes\">Fechar</button>' + botaoStatus + '</div>';",
  "",
  "  const { fechar } = abrirModal(html);",
  "  document.getElementById('botao-fechar-detalhes').addEventListener('click', fechar);",
  "",
  "  const botaoSalvarStatus = document.getElementById('botao-salvar-status');",
  "  if (botaoSalvarStatus) {",
  "    botaoSalvarStatus.addEventListener('click', async () => {",
  "      const campoStatus = document.getElementById('campo-status-pedido');",
  "      const erroStatus = document.getElementById('erro-status-pedido');",
  "      const novoStatus = campoStatus.value;",
  "      erroStatus.classList.add('hidden');",
  "      if (!novoStatus) {",
  "        erroStatus.textContent = 'Selecione o novo status do pedido.';",
  "        erroStatus.classList.remove('hidden');",
  "        return;",
  "      }",
  "      botaoSalvarStatus.disabled = true;",
  "      botaoSalvarStatus.textContent = 'Salvando…';",
  "      try {",
  "        await apiFetch('/lojas/' + lojaAtualId + '/pedidos/' + pedido.id + '/status', { method: 'PATCH', body: JSON.stringify({ status: novoStatus }) });",
  "        produtosCache = null;",
  "        mostrarToast(novoStatus === 'cancelado' ? 'Pedido cancelado e estoque reposto.' : 'Status do pedido atualizado.', 'sucesso');",
  "        fechar();",
  "        await carregarPedidos();",
  "      } catch (erro) {",
  "        if (erro instanceof SessaoExpiradaError) return fazerLogout();",
  "        erroStatus.textContent = erro.message || 'Não foi possível atualizar o status.';",
  "        erroStatus.classList.remove('hidden');",
  "        botaoSalvarStatus.disabled = false;",
  "        botaoSalvarStatus.textContent = 'Salvar status';",
  "      }",
  "    });",
  "  }",
  "}",
  ""
].join('\n');
pedidosSrc = pedidosSrc.slice(0, inicio) + novoBloco + pedidosSrc.slice(fim);
fs.writeFileSync(pedidosPath, pedidosSrc);

console.log('Patch de gestão de status de pedidos aplicado.');
