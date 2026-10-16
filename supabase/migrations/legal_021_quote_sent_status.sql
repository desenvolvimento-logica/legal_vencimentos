-- legal_021 — Situação "Orçamento enviado" (QUOTE_SENT), decisão de 16/10/2026.
--
-- Só acrescenta o valor ao enum. O Postgres não permite usar um valor novo
-- de enum na mesma transação em que foi criado, por isso as regras que o
-- usam ficam em legal_022 e esta migration precisa ser aplicada (e
-- confirmada) antes dela, em execução separada.
--
-- Idempotente. Rollback: valores de enum não podem ser removidos sem
-- recriar o tipo; mantê-lo sem uso é inofensivo.

alter type public.legal_expiration_status add value if not exists 'QUOTE_SENT' after 'RENEWING';
