'use strict';

/**
 * Órbita Vendas — núcleo determinístico de qualificação para testes.
 * Não envia mensagens, não agenda compromissos e não acessa dados reais.
 * O modelo de IA deverá receber a skill aprovada separadamente.
 */
const STATES = Object.freeze({
  NEW: 'NEW', DISCOVERY: 'DISCOVERY', QUALIFIED: 'QUALIFIED',
  DEMO_OFFERED: 'DEMO_OFFERED', HUMAN_HANDOFF: 'HUMAN_HANDOFF',
  OPTED_OUT: 'OPTED_OUT'
});
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const has = (text, words) => words.some(word => text.includes(word));

function respond({ message, state = STATES.NEW } = {}) {
  if (typeof message !== 'string' || !message.trim()) {
    return { state, reply: 'Não consegui entender. Pode escrever sua dúvida?', action: 'clarify' };
  }
  const text = normalize(message);
  if (state === STATES.OPTED_OUT) return { state, reply: '', action: 'none' };
  if (has(text, ['pare de mandar', 'nao me mande', 'nao quero contato', 'remova meu contato', 'nao me contate', 'sair da lista'])) {
    return { state: STATES.OPTED_OUT, reply: 'Entendido. Não enviaremos novos contatos comerciais.', action: 'opt_out' };
  }
  if (has(text, ['humano', 'pessoa de verdade', 'atendente', 'falar com alguem', 'reclamacao', 'excluir meus dados'])) {
    return { state: STATES.HUMAN_HANDOFF, reply: 'Vou solicitar atendimento humano. Ainda não confirmei a transferência.', action: 'handoff_requested' };
  }
  if (has(text, ['preco', 'quanto custa', 'mensalidade', 'desconto', 'valor do plano'])) {
    return { state, reply: 'Não tenho uma tabela de preços confirmada neste teste. Posso encaminhar sua pergunta para a equipe.', action: 'pricing_unavailable' };
  }
  if (has(text, ['agendar', 'demonstracao', 'mostrar como funciona', 'quero ver'])) {
    return { state: STATES.DEMO_OFFERED, reply: 'Podemos organizar uma demonstração. Preciso confirmar a disponibilidade com a equipe antes de sugerir um horário.', action: 'demo_requested' };
  }
  if (has(text, ['whatsapp', 'orcamento', 'cliente', 'vendas', 'mensagens', 'atendimento'])) {
    return { state: STATES.DISCOVERY, reply: 'Sou o assistente virtual do Órbita. O maior desafio hoje é responder rapidamente ou acompanhar os orçamentos que ficam sem retorno?', action: 'discovery' };
  }
  return { state: STATES.DISCOVERY, reply: 'Sou o assistente virtual do Órbita. Qual é a maior dificuldade da sua empresa no atendimento aos clientes?', action: 'discovery' };
}
module.exports = { STATES, respond };
