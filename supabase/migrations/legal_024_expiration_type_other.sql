-- legal_024 — Tipo de vencimento "Outros" (OUTRO), decisão de 19/10/2026.
--
-- Para documentos que não são certidão, licença nem certificado (procuração
-- eletrônica, declarações, isenções, atas etc.), necessários na importação
-- do sistema anterior.
--
-- Valor novo de enum: aplicar sozinha e confirmar antes de qualquer script
-- que o use (o Postgres não permite usá-lo na mesma transação).
--
-- Idempotente. Rollback: valores de enum não podem ser removidos sem
-- recriar o tipo; mantê-lo sem uso é inofensivo.

alter type public.legal_expiration_type add value if not exists 'OUTRO' after 'CERTIFICADO';
