-- legal_002 — Perfis autorizados a usar a aplicação.
-- Idempotente. Rollback: supabase/rollback/legal_rollback_all.sql

create table if not exists public.legal_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete restrict,
  name text not null,
  email text not null unique,
  job_title text,
  hierarchy_level public.legal_hierarchy_level not null default 'USER',
  manager_id uuid references public.legal_profiles (id) on delete restrict,
  is_admin boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint legal_profiles_name_check
    check (char_length(btrim(name)) between 1 and 200),
  constraint legal_profiles_email_normalized_check
    check (email <> '' and email = lower(btrim(email))),
  constraint legal_profiles_job_title_check
    check (job_title is null or char_length(job_title) <= 200),
  constraint legal_profiles_manager_not_self_check
    check (manager_id is null or manager_id <> id),
  -- is_admin e o nível ADMIN precisam ser consistentes (DATABASE.md §4).
  constraint legal_profiles_admin_consistent_check
    check (is_admin = (hierarchy_level = 'ADMIN'))
);

comment on table public.legal_profiles is
  'Controle de Vencimentos (Legalização): perfis autorizados e hierarquia.';
