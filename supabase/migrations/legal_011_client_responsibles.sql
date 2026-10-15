-- legal_011 — Responsáveis por departamento (Legalização 5 e subdepartamento 13)
-- e configurações da integração. Decisões do responsável em 15/10/2026:
-- a Legalização é o departamento 5 no Acessórias; o subdepartamento 13
-- (Certificado Digital) também define a carteira.
-- Idempotente. Rollback: remover a tabela e reaplicar as definições de
-- legal_006/legal_007 para legal_can_access_client e legal_clients_select.

create table if not exists public.legal_client_responsibles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.legal_clients (id) on delete cascade,
  department_id text not null,
  department_name text,
  responsible_name text,
  responsible_email text,
  responsible_acessorias_user_id text,
  synced_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint legal_client_responsibles_client_department_key
    unique (client_id, department_id),
  constraint legal_client_responsibles_email_normalized_check
    check (
      responsible_email is null
      or responsible_email = lower(btrim(responsible_email))
    )
);

comment on table public.legal_client_responsibles is
  'Controle de Vencimentos (Legalização): responsáveis por departamento (cache do Acessórias). Define a carteira.';

create index if not exists legal_client_responsibles_email_idx
  on public.legal_client_responsibles (responsible_email);

drop trigger if exists legal_client_responsibles_set_updated_at
  on public.legal_client_responsibles;
create trigger legal_client_responsibles_set_updated_at
  before update on public.legal_client_responsibles
  for each row execute function public.legal_set_updated_at();

-- ---------------------------------------------------------------------------
-- Escopo de clientes pelos responsáveis de qualquer departamento da Legalização
-- ---------------------------------------------------------------------------

-- Clientes visíveis ao usuário atual. SECURITY DEFINER evita recursão entre
-- as policies de legal_clients e legal_client_responsibles.
create or replace function public.legal_visible_client_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.legal_clients c
  where public.legal_has_global_scope()
  union
  select r.client_id
  from public.legal_client_responsibles r
  where r.responsible_email in (select public.legal_scope_emails());
$$;

create or replace function public.legal_can_access_client(client_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select client_uuid in (select public.legal_visible_client_ids());
$$;

drop policy if exists legal_clients_select on public.legal_clients;
create policy legal_clients_select on public.legal_clients
  for select to authenticated
  using (id in (select public.legal_visible_client_ids()));

alter table public.legal_client_responsibles enable row level security;

revoke all on table public.legal_client_responsibles from anon, authenticated;
grant select on table public.legal_client_responsibles to authenticated;

drop policy if exists legal_client_responsibles_select
  on public.legal_client_responsibles;
create policy legal_client_responsibles_select
  on public.legal_client_responsibles
  for select to authenticated
  using (client_id in (select public.legal_visible_client_ids()));

revoke all on function public.legal_visible_client_ids()
  from public, anon, authenticated;
grant execute on function public.legal_visible_client_ids()
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Configurações da integração (só preenche o que ainda não foi definido)
-- ---------------------------------------------------------------------------

update public.legal_settings
set value = '"5"'
where key = 'acessorias_legalization_department_id'
  and value = 'null'::jsonb;

insert into public.legal_settings (key, value, description) values
  ('acessorias_legalization_subdepartment_ids', '["13"]',
    'Subdepartamentos da Legalização que também definem a carteira.'),
  ('acessorias_request_initial_window_days', '90',
    'Na carga inicial, sincroniza solicitações atualizadas nestes últimos dias.')
on conflict (key) do nothing;
