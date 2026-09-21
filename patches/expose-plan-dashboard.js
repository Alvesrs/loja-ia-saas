const fs = require('node:fs');

const path = 'public/dashboard.html';
let src = fs.readFileSync(path, 'utf8');

if (!src.includes('Meu plano')) {
  const alvo = `          <a class="action-btn" href="atendente.html">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>
            Testar atendente
          </a>`;

  const novo = alvo + `
          <a class="action-btn" href="plano.html">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h3"/></svg>
            Meu plano
          </a>`;

  if (!src.includes(alvo)) throw new Error('Trecho de ações rápidas não encontrado.');
  src = src.replace(alvo, novo);
}

fs.writeFileSync(path, src);
console.log('Patch de acesso ao Meu plano aplicado.');
