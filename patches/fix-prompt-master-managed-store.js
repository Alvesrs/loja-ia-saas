const fs=require('node:fs');
const p='public/js/atendente.js';
let s=fs.readFileSync(p,'utf8');
const antigo=`  } catch (erro) {
    if (erro instanceof SessaoExpiradaError) return fazerLogout();
    mostrarStatusPrompt(erro.message || 'Não foi possível salvar.', true);
  } finally {`;
const novo=`  } catch (erro) {
    if (erro instanceof SessaoExpiradaError) return fazerLogout();

    if (String(erro && erro.message || '').toLowerCase().includes('loja não encontrada')) {
      try {
        const cliente = await apiFetch('/admin/clientes-gerenciados/' + encodeURIComponent(lojaAtualIdChat));
        await apiFetch('/admin/clientes-gerenciados/' + encodeURIComponent(lojaAtualIdChat), {
          method: 'PUT',
          body: JSON.stringify({
            nome: cliente.nome,
            prompt_mestre: campoPromptEl.value,
            numero_whatsapp: cliente.whatsapp && cliente.whatsapp.numero_whatsapp || ''
          })
        });

        let lojaAtualizada = {};
        try { lojaAtualizada = JSON.parse(sessionStorage.getItem(LOJA_CACHE_KEY) || '{}') || {}; } catch (_) {}
        lojaAtualizada.id = lojaAtualIdChat;
        lojaAtualizada.prompt_mestre = campoPromptEl.value;
        sessionStorage.setItem(LOJA_CACHE_KEY, JSON.stringify(lojaAtualizada));
        promptAlterado = false;
        mostrarStatusPrompt('Salvo');
        return;
      } catch (erroAdmin) {
        if (erroAdmin instanceof SessaoExpiradaError) return fazerLogout();
        mostrarStatusPrompt(erroAdmin.message || 'Não foi possível salvar.', true);
        return;
      }
    }

    mostrarStatusPrompt(erro.message || 'Não foi possível salvar.', true);
  } finally {`;
if(!s.includes(antigo)) throw new Error('Trecho de salvar Prompt Mestre não encontrado.');
s=s.replace(antigo,novo);
fs.writeFileSync(p,s);
console.log('Patch de Prompt Mestre para loja gerenciada aplicado.');
