# SaintsAI — verificação gratuita de recuperação

Sem contratação de plano, mudança de senha, migração ou publicação em produção.

- Backup lógico criptografado retido separadamente do repositório: 94 tabelas, 2.218 registros (public/auth/storage).
- Integridade SHA-256 conferida antes da retenção. AES-256-GCM com chave de dados encapsulada por RSA-OAEP-SHA256; chave privada fora do Git.
- Três testes de criptografia passaram: recuperação, rejeição de adulteração e rejeição de chave incorreta.
- Restauração isolada em PGlite 0.5.10: 94 tabelas criadas com tipos e colunas geradas; 2.218 registros recuperados e comparados por multiconjunto JSONB sem diferenças; todas as 421 restrições aplicadas, incluindo exclusão de sobreposição de agendamentos.
- Origem PostgreSQL 17.6; validador PostgreSQL 18.6. Não equivale a ensaio completo no mesmo ambiente do provedor.
- Este ensaio não restaura funções, defaults, papéis/permissões ou políticas do provedor. O snapshot contém parte desses metadados, mas não equivale a um pg_dump completo do Supabase.
- Storage: todos os 12 objetos baixados pelo painel, comparados ao inventário/tamanhos e ETags quando disponíveis, e retidos em arquivo criptografado. Recuperação do arquivo e hashes SHA-256 dos 12 objetos verificados; 5.795.870 bytes.

Verificações do código já registradas na etapa 19: 344 testes do backend e 10 de PostgreSQL passaram em CI. A execução ampliada anterior tinha 19 falhas e não constitui aprovação global. A publicação permanece pendente de fechamento dessas divergências e validação da recuperação/reversão necessária ao escopo implantado.

Nenhum evento antigo foi reenviado e nenhuma mensagem real de teste foi enviada.
