const fs = require('node:fs');

const path = 'src/app.js';
const source = fs.readFileSync(path, 'utf8');

const oldBlock = `app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/lojas', lojasRoutes);
app.use('/api/lojas/:lojaId/produtos', produtosRoutes);
app.use('/api/lojas/:lojaId/clientes', clientesRoutes);
app.use('/api/lojas/:lojaId/pedidos', pedidosRoutes);
app.use('/api/lojas/:lojaId/ia', iaRoutes);
app.use('/api/lojas/:lojaId/whatsapp', whatsappConfiguracaoRoutes);
app.use('/api/lojas/:lojaId/assinatura', assinaturasRoutes);`;

const newBlock = `app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// A rota de IA é pública para o cliente final. Ela precisa ser montada
// antes de /api/lojas, cujo router aplica exigirLogin globalmente.
app.use('/api/lojas/:lojaId/ia', iaRoutes);

app.use('/api/lojas', lojasRoutes);
app.use('/api/lojas/:lojaId/produtos', produtosRoutes);
app.use('/api/lojas/:lojaId/clientes', clientesRoutes);
app.use('/api/lojas/:lojaId/pedidos', pedidosRoutes);
app.use('/api/lojas/:lojaId/whatsapp', whatsappConfiguracaoRoutes);
app.use('/api/lojas/:lojaId/assinatura', assinaturasRoutes);`;

if (!source.includes(oldBlock)) {
  throw new Error('Bloco esperado de rotas não encontrado; patch não aplicado.');
}

const patched = source.replace(oldBlock, newBlock);
fs.writeFileSync(path, patched);
console.log('Patch de rota pública da IA aplicado.');
