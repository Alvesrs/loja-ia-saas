(() => {
  async function atualizar() {
    const btn = document.getElementById('saintsai-update-fixed');
    if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    try {
      const r = await fetch('versao.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('version_unavailable');
      const v = await r.json();
      if (typeof v.versao !== 'string') throw new Error('invalid_version');
      const url = new URL(location.href);
      url.searchParams.set('atualizacao', v.versao);
      url.searchParams.set('recarregar', String(Date.now()));
      location.replace(url.href);
    } catch (_) {
      alert('Não foi possível buscar a atualização. Confira sua conexão e tente novamente.');
      if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
    }
  }
  function instalar() {
    const btn = document.getElementById('saintsai-update-fixed');
    if (!btn) return;
    btn.classList.add('show');
    btn.onclick = atualizar;
    btn.setAttribute('aria-label', 'Atualizar SaintsAI Cliente');
    const versao = document.getElementById('saintsai-update-version');
    if (versao) versao.textContent = ' · sistema 04/10';
    // O botão superior mantém a instalação nativa disponível, com nome claro.
    const android = document.getElementById('native-update');
    if (android) android.textContent = 'Atualizar Android';
  }
  window.SaintsAIAtualizar = atualizar;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalar);
  else instalar();
  // A página antiga também inicializa o botão aos 900ms; reafirma o novo fluxo.
  setTimeout(instalar, 1100);
})();
