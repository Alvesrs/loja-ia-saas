'use strict';
const assert = require('node:assert/strict');
const { respond, STATES } = require('./orbita-sales-pilot');

const tests = [
  { input: 'Quero automatizar meu WhatsApp', state: STATES.DISCOVERY, action: 'discovery' },
  { input: 'Quanto custa a mensalidade?', action: 'pricing_unavailable' },
  { input: 'Quero agendar uma demonstração', state: STATES.DEMO_OFFERED, action: 'demo_requested' },
  { input: 'Quero falar com um humano', state: STATES.HUMAN_HANDOFF, action: 'handoff_requested' },
  { input: 'Não quero contato', state: STATES.OPTED_OUT, action: 'opt_out' },
  { input: 'Olá', state: STATES.DISCOVERY, action: 'discovery' }
];
for (const test of tests) {
  const output = respond({ message: test.input });
  if (test.state) assert.equal(output.state, test.state, test.input);
  assert.equal(output.action, test.action, test.input);
}
const stopped = respond({ message: 'Quero ver preços', state: STATES.OPTED_OUT });
assert.equal(stopped.action, 'none');
assert.equal(stopped.reply, '');
assert.equal(respond({ message: '' }).action, 'clarify');
console.log('Órbita Vendas: 8 cenários de teste passaram.');
