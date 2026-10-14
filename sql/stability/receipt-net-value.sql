-- Candidate only. Apply after backup and restore validation, then enable
-- SAINTSAI_RECEIPT_NET_VALUE=1. Existing bookings are never backfilled.
BEGIN;
ALTER TABLE public.saintsai_agendamentos
  ADD COLUMN IF NOT EXISTS pagamento_valor_liquido numeric(12,2);
COMMENT ON COLUMN public.saintsai_agendamentos.pagamento_valor_liquido
  IS 'Net amount reported by the payment provider for PAYMENT_RECEIVED; NULL when unavailable. Not the contractual booking price.';
COMMIT;
