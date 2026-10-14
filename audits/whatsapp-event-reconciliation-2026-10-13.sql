-- SaintsAI: inspeção SEGURA dos eventos WhatsApp (somente SELECT).
-- Não executar UPDATE, DELETE nem reencaminhar mensagens a partir destes resultados.
-- A chave id_externo pode representar namespaces diferentes por tabela.
-- Conferir primeiro o provedor e a semântica de cada identificador.

-- 1. Estados e idade do registro de eventos.
select provedor, status, count(*) total,
       min(recebido_em) as mais_antigo,
       max(recebido_em) as mais_recente,
       count(*) filter (where recebido_em < now() - interval '24 hours') as antigos_24h
from public.whatsapp_eventos_processados
group by provedor, status
order by total desc;

-- 2. Saúde da fila operacional.
select provedor, status, count(*) total,
       count(*) filter (where status = 'processando' and lease_ate < now()) as leases_expirados,
       count(*) filter (where proxima_tentativa_em < now() and status <> 'concluido') as retries_vencidos,
       max(atualizado_em) as ultima_atualizacao
from public.whatsapp_fila_processamento
group by provedor, status
order by total desc;

-- 3. Comparação preliminar dos IDs externos. A ausência de correspondência
-- NÃO demonstra perda de mensagens: auditar fluxo de criação de cada tabela.
select e.provedor,
       count(*) as eventos_em_processamento,
       count(*) filter (
         where exists (
           select 1 from public.whatsapp_fila_processamento f
           where f.provedor = e.provedor and f.id_externo = e.id_externo
         )
       ) as com_correspondencia_na_fila
from public.whatsapp_eventos_processados e
where e.status = 'processando'
group by e.provedor;

-- 4. Possíveis identificadores repetidos no registro de eventos.
select provedor, id_externo, count(*) total
from public.whatsapp_eventos_processados
group by provedor, id_externo
having count(*) > 1
order by total desc
limit 30;

-- Antes de recuperar:
-- (a) verificar webhook -> deduplicação -> criação na fila -> confirmação WAHA/Meta;
-- (b) conferir mensagens já enviadas no provedor e por contato, sem divulgar conteúdo;
-- (c) marcar estados com transações e idempotência após comprovação;
-- (d) testar repetição de webhook, timeout, reinício do worker e takeover humano;
-- (e) nunca concluir "entregue" somente porque o worker retornou sucesso.


-- 5. Verificar histórico por mesmo provedor e id_externo, sem exibir dados pessoais.
-- Ausência não prova falha de entrega; formatos de ID precisam ser confirmados no código.
select e.provedor,count(*) as eventos_em_processamento,
       count(*) filter(where exists (
         select 1 from public.whatsapp_mensagens m
         where m.provedor=e.provedor and m.id_externo=e.id_externo
       )) as presentes_no_historico
from public.whatsapp_eventos_processados e
where e.status='processando'
group by e.provedor;

-- 6. Localizar os dias que concentram registros antigos.
select date_trunc('day',recebido_em) as dia,provedor,count(*) as total
from public.whatsapp_eventos_processados
where status='processando'
group by 1,2
order by dia desc;

-- A estratégia de recuperação deverá ser definida somente após verificar
-- como o backend constrói id_externo para cada um dos três registros.
