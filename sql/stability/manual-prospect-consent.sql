BEGIN;
ALTER TABLE public.saintsai_sales_conversations
 ADD COLUMN IF NOT EXISTS manual_recipient_permission jsonb;
COMMIT;
