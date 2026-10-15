-- legal_001 — Enums do sistema Controle de Vencimentos da Legalização.
-- Idempotente: cria cada tipo somente se ainda não existir.
-- Rollback: supabase/rollback/legal_rollback_all.sql

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'legal_hierarchy_level'
  ) then
    -- A ordem de declaração define a comparação (USER < ... < ADMIN).
    create type public.legal_hierarchy_level as enum
      ('USER', 'LEADER', 'COORDINATOR', 'MANAGER', 'DIRECTOR', 'ADMIN');
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'legal_expiration_type'
  ) then
    create type public.legal_expiration_type as enum
      ('CERTIDAO', 'LICENCA', 'CERTIFICADO');
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'legal_expiration_status'
  ) then
    create type public.legal_expiration_status as enum
      ('ACTIVE', 'RENEWING', 'RENEWED', 'EXPIRED', 'CANCELLED');
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'legal_sync_status'
  ) then
    create type public.legal_sync_status as enum
      ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');
  end if;
end
$$;
