-- legal_005 — Solicitações (cache), configurações, auditoria e logs de sincronização.
-- Idempotente. Rollback: supabase/rollback/legal_rollback_all.sql

create table if not exists public.legal_acessorias_requests (
  id uuid primary key default gen_random_uuid(),
  acessorias_request_id text not null unique,
  acessorias_company_id text,
  company_document_number text,
  company_name text,
  request_type text,
  subject text,
  priority text,
  status text,
  requester_name text,
  requester_id text,
  department_id text,
  department_name text,
  office_responsibles jsonb,
  office_responsible_ids jsonb,
  opened_at timestamptz,
  due_at timestamptz,
  last_update_at timestamptz,
  completed_at timestamptz,
  synced_at timestamptz not null
);

comment on table public.legal_acessorias_requests is
  'Controle de Vencimentos (Legalização): cache somente leitura de solicitações do Acessórias.';

create table if not exists public.legal_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.legal_profiles (id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

comment on table public.legal_audit_logs is
  'Controle de Vencimentos (Legalização): auditoria append-only.';

create table if not exists public.legal_sync_logs (
  id uuid primary key default gen_random_uuid(),
  integration text not null,
  sync_type text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  status public.legal_sync_status not null,
  records_received integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  records_failed integer not null default 0,
  error_message text,
  metadata jsonb,
  created_at timestamptz not null default now(),

  constraint legal_sync_logs_records_received_check check (records_received >= 0),
  constraint legal_sync_logs_records_created_check check (records_created >= 0),
  constraint legal_sync_logs_records_updated_check check (records_updated >= 0),
  constraint legal_sync_logs_records_failed_check check (records_failed >= 0)
);

comment on table public.legal_sync_logs is
  'Controle de Vencimentos (Legalização): execuções de sincronização com o Acessórias.';

create table if not exists public.legal_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

comment on table public.legal_settings is
  'Controle de Vencimentos (Legalização): configuração não secreta. Nunca armazenar tokens.';

-- Chaves iniciais sem valor; preenchidas pelo administrador/sincronização.
insert into public.legal_settings (key, value, description) values
  ('acessorias_legalization_department_id', 'null',
    'ID do departamento Legalização no Acessórias.'),
  ('last_successful_company_sync', 'null',
    'Cursor da última sincronização de empresas concluída com sucesso.'),
  ('last_successful_user_sync', 'null',
    'Cursor da última sincronização de usuários concluída com sucesso.'),
  ('last_successful_request_sync', 'null',
    'Cursor da última sincronização de solicitações concluída com sucesso.')
on conflict (key) do nothing;
