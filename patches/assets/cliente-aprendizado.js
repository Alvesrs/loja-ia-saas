(() => {
  const inicio = '[SAINTSAI_CORRECOES_DONO]', fim = '[/SAINTSAI_CORRECOES_DONO]';
  function instalar() {
    const prompt = document.getElementById('ia-prompt');
    if (!prompt || document.getElementById('ia-correcao')) return;
    const box = document.createElement('details');
    box.className = 'field';
    box.innerHTML = '<summary style="cursor:pointer;font-weight:850;color:#c5a7ef;padding:12px 0">Ensinar a IA com uma correção</summary><p class="muted">A IA usa o histórico recente para continuar cada conversa. Para corrigir um erro que deve valer em novos atendimentos, escreva aqui a regra correta. Preços, estoque, agenda e pagamentos continuam seguindo os dados do sistema.</p><label for="ia-correcao">O que a IA deve fazer nas próximas conversas?</label><textarea id="ia-correcao" maxlength="1000" style="min-height:100px" placeholder="Ex.: Quando perguntarem sobre entrega, pergunte primeiro o bairro."></textarea><button type="button" class="btn secondary" id="ia-aplicar-correcao">Adicionar ao Prompt Mestre</button><div class="status" id="ia-correcao-status" role="status"></div>';
    document.getElementById('ia-status').after(box);
    document.getElementById('ia-aplicar-correcao').onclick = () => {
      const campo = document.getElementById('ia-correcao');
      const st = document.getElementById('ia-correcao-status');
      const texto = campo.value.trim();
      if (texto.length < 10) { st.textContent = 'Escreva a correção com um pouco mais de detalhe.'; return; }
      if (texto.includes(inicio) || texto.includes(fim)) { st.textContent = 'Escreva a correção sem marcadores internos.'; return; }
      const base = prompt.value;
      const a = base.indexOf(inicio), b = base.indexOf(fim, a);
      const existente = a >= 0 && b > a ? base.slice(a + inicio.length, b).trim() : '';
      if (existente.split('\n').includes('- ' + texto)) { st.textContent = 'Essa correção já está no prompt.'; return; }
      const limpo = a >= 0 && b > a ? (base.slice(0, a) + base.slice(b + fim.length)).trim() : base.trim();
      const bloco = inicio + '\n' + (existente ? existente + '\n' : '') + '- ' + texto + '\n' + fim;
      const novo = [limpo, bloco].filter(Boolean).join('\n\n');
      if (novo.length > 12000) { st.textContent = 'Revise as regras antigas antes de adicionar novas correções.'; return; }
      prompt.value = novo;
      campo.value = '';
      st.textContent = 'Correção adicionada. Revise o Prompt Mestre e clique em Salvar IA para ativar.';
    };
  }
  new MutationObserver(instalar).observe(document.body, { childList: true, subtree: true });
  instalar();
})();
