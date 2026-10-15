-- legal_004 — Vencimentos (certidões, licenças e certificados).
-- Idempotente. Rollback: supabase/rollback/legal_rollback_all.sql

create table if not exists public.legal_expirations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.legal_clients (id) on delete restrict,
  expiration_type public.legal_expiration_type not null,
  document_name text not null,
  document_number text,
  issuer text,
  issue_date date,
  expiration_date date not null,
  responsible_user_id uuid references public.legal_profiles (id) on delete restrict,
  status public.legal_expiration_status not null default 'ACTIVE',
  notes text,
  previous_expiration_id uuid references public.legal_expirations (id) on delete restrict,
  renewed_at timestamptz,
  -- created_by/updated_by são sempre derivados da sessão pelo trigger (legal_006).
  created_by uuid not null references public.legal_profiles (id) on delete restrict,
  updated_by uuid not null references public.legal_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint legal_expirations_document_name_check
    check (char_length(btrim(document_name)) between 1 and 200),
  constraint legal_expirations_document_number_check
    check (document_number is null or char_length(document_number) <= 100),
  constraint legal_expirations_issuer_check
    check (issuer is null or char_length(issuer) <= 200),
  constraint legal_expirations_notes_check
    check (notes is null or char_length(notes) <= 2000),
  constraint legal_expirations_previous_not_self_check
    check (previous_expiration_id is null or previous_expiration_id <> id),
  constraint legal_expirations_renewed_at_check
    check ((status = 'RENEWED') = (renewed_at is not null))
);

comment on table public.legal_expirations is
  'Controle de Vencimentos (Legalização): vencimentos e cadeia de renovações.';
