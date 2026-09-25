const fs=require('node:fs');
const p='src/controllers/admin.controller.js';
let c=fs.readFileSync(p,'utf8');

// Em listarClientesGerenciados, a tabela lojas usa criado_em.
c=c.replace(
  ".from('lojas')\n      .select('id, nome, dono_id, ativa, prompt_mestre, criado_em')\n      .in('dono_id', ids)\n      .order('created_at', { ascending: false })",
  ".from('lojas')\n      .select('id, nome, dono_id, ativa, prompt_mestre, criado_em')\n      .in('dono_id', ids)\n      .order('criado_em', { ascending: false })"
);

// whatsapp_configuracoes usa created_at.
c=c.replace(
  ".from('whatsapp_configuracoes')\n      .select('id, provedor, numero_whatsapp, identificador_externo, ativo')\n      .eq('loja_id', lojaId)\n      .order('criado_em', { ascending: false })",
  ".from('whatsapp_configuracoes')\n      .select('id, provedor, numero_whatsapp, identificador_externo, ativo')\n      .eq('loja_id', lojaId)\n      .order('created_at', { ascending: false })"
);

fs.writeFileSync(p,c);
console.log('Admin: lojas ordenam por criado_em e WhatsApp por created_at.');
