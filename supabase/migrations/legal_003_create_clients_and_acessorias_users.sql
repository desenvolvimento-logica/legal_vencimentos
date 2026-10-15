-- legal_003 — Caches de empresas e usuários do Acessórias.
-- Idempotente. Rollback: supabase/rollback/legal_rollback_all.sql

create table if not exists public.legal_clients (
  id uuid primary key default gen_random_uuid(),
  acessorias_company_id text not null unique,
  document_number text,
  corporate_name text not null,
  trade_name text,
  status text,
  state text,
  legalization_department_id text,
  legalization_responsible_name text,
  legalization_responsible_email text,
  legalization_responsible_acessorias_user_id text,
  acessorias_updated_at timestamptz,
  synced_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- O escopo compara este e-mail com legal_profiles.email; a sincronização normaliza.
  constraint legal_clients_responsible_email_normalized_check
    check (
      legalization_responsible_email is null
      or legalization_responsible_email = lower(btrim(legalization_responsible_email))
    )
);

comment on table public.legal_clients is
  'Controle de Vencimentos (Legalização): cache de empresas do Acessórias. Não editável manualmente.';

create table if not exists public.legal_acessorias_users (
  id uuid primary key default gen_random_uuid(),
  acessorias_user_id text not null unique,
  name text,
  email text,
  status text,
  synced_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint legal_acessorias_users_email_normalized_check
    check (email is null or email = lower(btrim(email)))
);

comment on table public.legal_acessorias_users is
  'Controle de Vencimentos (Legalização): cache de usuários do Acessórias. Não concede acesso.';
