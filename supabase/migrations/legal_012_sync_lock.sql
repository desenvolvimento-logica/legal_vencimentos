-- legal_012 — No máximo uma sincronização RUNNING por integração e tipo.
-- O índice único parcial torna a exclusão mútua atômica: um segundo INSERT
-- com status RUNNING falha. Execuções interrompidas (sem fechamento) são
-- encerradas pelo orquestrador antes de iniciar uma nova.
-- Idempotente. Rollback: drop index public.legal_sync_logs_one_running_idx.

create unique index if not exists legal_sync_logs_one_running_idx
  on public.legal_sync_logs (integration, sync_type)
  where status = 'RUNNING';
