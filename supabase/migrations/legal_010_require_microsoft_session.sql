-- legal_010 — Somente sessões autenticadas pela Microsoft (Azure/Entra ID)
-- acessam o sistema. O login por e-mail/senha continua habilitado no projeto
-- compartilhado; uma sessão por senha não é reconhecida por estas funções.
-- Idempotente (create or replace / drop policy if exists em objetos legal_).
-- Rollback: reaplicar as definições de legal_006 e legal_007 (auth.uid()).

-- Sessão Microsoft: o JWT registra login OAuth (amr) e o usuário tem a
-- identidade azure vinculada (app_metadata.providers). O amr é preservado
-- nas renovações de token.
create or replace function public.legal_session_is_microsoft()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(auth.jwt() -> 'amr') = 'array'
    and exists (
      select 1
      from jsonb_array_elements(auth.jwt() -> 'amr') as m (entry)
      where m.entry ->> 'method' = 'oauth'
    )
    and jsonb_typeof(auth.jwt() -> 'app_metadata' -> 'providers') = 'array'
    and (auth.jwt() -> 'app_metadata' -> 'providers') ? 'azure',
    false
  );
$$;

-- auth.uid() somente quando a sessão veio da Microsoft; caso contrário, null.
create or replace function public.legal_auth_uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select case when public.legal_session_is_microsoft() then auth.uid() end;
$$;

-- ---------------------------------------------------------------------------
-- Funções de perfil e escopo passam a usar legal_auth_uid()
-- (mesmas definições de legal_006, trocando auth.uid()).
-- ---------------------------------------------------------------------------

create or replace function public.legal_current_profile()
returns setof public.legal_profiles
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.legal_profiles p
  where p.user_id = public.legal_auth_uid()
    and p.active;
$$;

create or replace function public.legal_current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.legal_profiles p
  where p.user_id = public.legal_auth_uid()
    and p.active;
$$;

create or replace function public.legal_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.legal_profiles p
    where p.user_id = public.legal_auth_uid()
      and p.active
      and (p.is_admin or p.hierarchy_level = 'ADMIN')
  );
$$;

create or replace function public.legal_has_global_scope()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.legal_profiles p
    where p.user_id = public.legal_auth_uid()
      and p.active
      and (p.is_admin or p.hierarchy_level in ('DIRECTOR', 'ADMIN'))
  );
$$;

create or replace function public.legal_get_user_scope()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with recursive
  me as (
    select p.id, p.hierarchy_level, p.is_admin
    from public.legal_profiles p
    where p.user_id = public.legal_auth_uid()
      and p.active
  ),
  tree (id, path) as (
    select me.id, array[me.id]
    from me
    where me.hierarchy_level in ('COORDINATOR', 'MANAGER')
    union all
    select child.id, tree.path || child.id
    from public.legal_profiles child
    join tree on child.manager_id = tree.id
    where not child.id = any (tree.path)
  )
  select p.id
  from public.legal_profiles p
  cross join me
  where me.is_admin or me.hierarchy_level in ('DIRECTOR', 'ADMIN')
  union
  select me.id from me
  union
  select child.id
  from public.legal_profiles child
  join me on child.manager_id = me.id
  where me.hierarchy_level = 'LEADER'
    and child.hierarchy_level = 'USER'
  union
  select tree.id from tree;
$$;

drop policy if exists legal_profiles_select on public.legal_profiles;
create policy legal_profiles_select on public.legal_profiles
  for select to authenticated
  using (
    user_id = (select public.legal_auth_uid())
    or (select public.legal_is_admin())
  );

-- ---------------------------------------------------------------------------
-- Privilégios das novas funções
-- ---------------------------------------------------------------------------

revoke all on function
  public.legal_session_is_microsoft(),
  public.legal_auth_uid()
from public, anon, authenticated;

grant execute on function
  public.legal_session_is_microsoft(),
  public.legal_auth_uid()
to authenticated, service_role;
