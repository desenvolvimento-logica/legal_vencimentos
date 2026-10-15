-- legal_008 — Índices.
-- Idempotente. Rollback: supabase/rollback/legal_rollback_all.sql
-- Colunas UNIQUE (user_id, email, acessorias_*_id) já têm índice implícito.
-- E-mails são armazenados normalizados (CHECK), então dispensam índice em lower(email).

create index if not exists legal_profiles_manager_id_idx
  on public.legal_profiles (manager_id);
create index if not exists legal_profiles_active_level_idx
  on public.legal_profiles (active, hierarchy_level);

create index if not exists legal_clients_document_number_idx
  on public.legal_clients (document_number);
create index if not exists legal_clients_corporate_name_idx
  on public.legal_clients (corporate_name);
create index if not exists legal_clients_responsible_email_idx
  on public.legal_clients (legalization_responsible_email);
create index if not exists legal_clients_status_idx
  on public.legal_clients (status);

create index if not exists legal_acessorias_users_email_idx
  on public.legal_acessorias_users (email);
create index if not exists legal_acessorias_users_status_idx
  on public.legal_acessorias_users (status);

create index if not exists legal_expirations_client_date_idx
  on public.legal_expirations (client_id, expiration_date)
  where deleted_at is null;
create index if not exists legal_expirations_status_date_idx
  on public.legal_expirations (status, expiration_date)
  where deleted_at is null;
create index if not exists legal_expirations_responsible_idx
  on public.legal_expirations (responsible_user_id)
  where deleted_at is null;
create index if not exists legal_expirations_created_by_idx
  on public.legal_expirations (created_by);
-- Um vencimento tem no máximo um sucessor: impede renovação duplicada.
create unique index if not exists legal_expirations_one_successor_idx
  on public.legal_expirations (previous_expiration_id)
  where previous_expiration_id is not null and deleted_at is null;

create index if not exists legal_acessorias_requests_company_idx
  on public.legal_acessorias_requests (acessorias_company_id);
create index if not exists legal_acessorias_requests_document_idx
  on public.legal_acessorias_requests (company_document_number);
create index if not exists legal_acessorias_requests_status_idx
  on public.legal_acessorias_requests (status);
create index if not exists legal_acessorias_requests_department_idx
  on public.legal_acessorias_requests (department_id);
create index if not exists legal_acessorias_requests_due_at_idx
  on public.legal_acessorias_requests (due_at);
create index if not exists legal_acessorias_requests_last_update_idx
  on public.legal_acessorias_requests (last_update_at);

create index if not exists legal_audit_logs_created_at_idx
  on public.legal_audit_logs (created_at desc);
create index if not exists legal_audit_logs_user_created_idx
  on public.legal_audit_logs (user_id, created_at desc);
create index if not exists legal_audit_logs_entity_idx
  on public.legal_audit_logs (entity_type, entity_id);
create index if not exists legal_audit_logs_action_created_idx
  on public.legal_audit_logs (action, created_at desc);

create index if not exists legal_sync_logs_type_started_idx
  on public.legal_sync_logs (integration, sync_type, started_at desc);
create index if not exists legal_sync_logs_status_started_idx
  on public.legal_sync_logs (status, started_at desc);
