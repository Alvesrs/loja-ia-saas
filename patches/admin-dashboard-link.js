const fs = require('node:fs');

const path = 'public/dashboard.html';
let src = fs.readFileSync(path, 'utf8');

if (!src.includes('id="dashboard-admin-link"')) {
  const alvo = `          <a class="action-btn" href="plano.html">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h3"/></svg>
            Meu plano
          </a>`;

  const admin = alvo + `
          <a class="action-btn" id="dashboard-admin-link" href="admin.html" style="display:none">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7l7-4z"/><path d="M9 12l2 2 4-4"/></svg>
            Admin
          </a>`;

  if (!src.includes(alvo)) throw new Error('Ação Meu plano não encontrada no dashboard.');
  src = src.replace(alvo, admin);

  const script = `
<script>
(async function mostrarAdminNoDashboard() {
  try {
    const perfil = await apiFetch('/admin/me');
    const link = document.getElementById('dashboard-admin-link');
    if (link && perfil && perfil.admin) link.style.display = 'inline-flex';
  } catch (_) {
    // Usuários comuns não veem o atalho administrativo.
  }
})();
</script>
`;
  src = src.replace('</body>', script + '</body>');
}

fs.writeFileSync(path, src);
console.log('Patch de atalho Admin no Dashboard aplicado.');
