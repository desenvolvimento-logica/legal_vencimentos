-- legal_007 — RLS, policies e privilégios.
-- Idempotente (drop policy if exists apenas em policies legal_).
-- Rollback: supabase/rollback/legal_rollback_all.sql
--
-- Os privilégios padrão do Supabase concedem tudo a anon/authenticated em tabelas
-- novas do schema public. Aqui eles são revogados e reconcedidos no mínimo
-- necessário; o RLS é a barreira final. service_role mantém acesso para a
-- sincronização server-side (ignora RLS).

-- ---------------------------------------------------------------------------
-- RLS habilitada em todas as tabelas
-- ---------------------------------------------------------------------------

alter table public.legal_profiles enable row level security;
alter table public.legal_clients enable row level security;
alter table public.legal_acessorias_users enable row level security;
alter table public.legal_expirations enable row level security;
alter table public.legal_acessorias_requests enable row level security;
alter table public.legal_audit_logs enable row level security;
alter table public.legal_sync_logs enable row level security;
alter table public.legal_settings enable row level security;

-- ---------------------------------------------------------------------------
-- Privilégios de tabela
-- ---------------------------------------------------------------------------

revoke all on table
  public.legal_profiles,
  public.legal_clients,
  public.legal_acessorias_users,
  public.legal_expirations,
  public.legal_acessorias_requests,
  public.legal_audit_logs,
  public.legal_sync_logs,
  public.legal_settings
from anon, authenticated;

grant select on table
  public.legal_profiles,
  public.legal_clients,
  public.legal_acessorias_users,
  public.legal_acessorias_requests,
  public.legal_audit_logs,
  public.legal_sync_logs,
  public.legal_settings
to authenticated;

-- DELETE físico nunca é concedido; exclusão é lógica (deleted_at).
grant select, insert, update on table public.legal_expirations to authenticated;

-- ---------------------------------------------------------------------------
-- Privilégios de função
-- ---------------------------------------------------------------------------

revoke all on function
  public.legal_set_updated_at(),
  public.legal_current_profile(),
  public.legal_current_profile_id(),
  public.legal_is_admin(),
  public.legal_has_global_scope(),
  public.legal_get_user_scope(),
  public.legal_scope_emails(),
  public.legal_can_access_client(uuid),
  public.legal_profiles_validate_hierarchy(),
  public.legal_expirations_before_write(),
  public.legal_expirations_audit(),
  public.legal_complete_renewal(uuid, jsonb)
from public, anon, authenticated;

grant execute on function
  public.legal_current_profile(),
  public.legal_current_profile_id(),
  public.legal_is_admin(),
  public.legal_has_global_scope(),
  public.legal_get_user_scope(),
  public.legal_scope_emails(),
  public.legal_can_access_client(uuid),
  public.legal_complete_renewal(uuid, jsonb)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- Perfis: o próprio; ADMIN lê todos. Escrita apenas por fluxo administrativo
-- (Fase 8), sem privilégio de INSERT/UPDATE para authenticated por enquanto.
drop policy if exists legal_profiles_select on public.legal_profiles;
create policy legal_profiles_select on public.legal_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.legal_is_admin()));

-- Clientes: escopo pelo e-mail do responsável da Legalização.
drop policy if exists legal_clients_select on public.legal_clients;
create policy legal_clients_select on public.legal_clients
  for select to authenticated
  using (
    (select public.legal_has_global_scope())
    or legalization_responsible_email in (select public.legal_scope_emails())
  );

drop policy if exists legal_acessorias_users_select on public.legal_acessorias_users;
create policy legal_acessorias_users_select on public.legal_acessorias_users
  for select to authenticated
  using ((select public.legal_is_admin()));

-- Vencimentos: herdam o escopo do cliente (a subconsulta passa pelo RLS de legal_clients).
drop policy if exists legal_expirations_select on public.legal_expirations;
create policy legal_expirations_select on public.legal_expirations
  for select to authenticated
  using (
    deleted_at is null
    and exists (select 1 from public.legal_clients c where c.id = client_id)
  );

drop policy if exists legal_expirations_insert on public.legal_expirations;
create policy legal_expirations_insert on public.legal_expirations
  for insert to authenticated
  with check (exists (select 1 from public.legal_clients c where c.id = client_id));

drop policy if exists legal_expirations_update on public.legal_expirations;
create policy legal_expirations_update on public.legal_expirations
  for update to authenticated
  using (
    deleted_at is null
    and exists (select 1 from public.legal_clients c where c.id = client_id)
  )
  with check (exists (select 1 from public.legal_clients c where c.id = client_id));

-- Solicitações: visíveis quando o cliente correspondente é visível.
drop policy if exists legal_acessorias_requests_select on public.legal_acessorias_requests;
create policy legal_acessorias_requests_select on public.legal_acessorias_requests
  for select to authenticated
  using (
    exists (
      select 1 from public.legal_clients c
      where c.acessorias_company_id = legal_acessorias_requests.acessorias_company_id
    )
  );

drop policy if exists legal_audit_logs_select on public.legal_audit_logs;
create policy legal_audit_logs_select on public.legal_audit_logs
  for select to authenticated
  using ((select public.legal_is_admin()));

drop policy if exists legal_sync_logs_select on public.legal_sync_logs;
create policy legal_sync_logs_select on public.legal_sync_logs
  for select to authenticated
  using ((select public.legal_is_admin()));

drop policy if exists legal_settings_select on public.legal_settings;
create policy legal_settings_select on public.legal_settings
  for select to authenticated
  using ((select public.legal_is_admin()));
