-- legal_006 — Funções, regras de integridade e triggers.
-- Idempotente (create or replace / drop trigger if exists em objetos legal_).
-- Rollback: supabase/rollback/legal_rollback_all.sql
--
-- Todas as funções fixam search_path = '' e qualificam os objetos.
-- Funções SECURITY DEFINER leem legal_profiles sem passar pelo RLS, o que evita
-- recursão nas policies; os privilégios de execução são ajustados em legal_007.

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.legal_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfil da sessão
-- ---------------------------------------------------------------------------

-- Perfil ativo de auth.uid(); vazio se não houver perfil ou se estiver inativo.
create or replace function public.legal_current_profile()
returns setof public.legal_profiles
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.legal_profiles p
  where p.user_id = auth.uid()
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
  where p.user_id = auth.uid()
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
    where p.user_id = auth.uid()
      and p.active
      and (p.is_admin or p.hierarchy_level = 'ADMIN')
  );
$$;

-- DIRECTOR e ADMIN veem todos os clientes, inclusive os sem responsável.
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
    where p.user_id = auth.uid()
      and p.active
      and (p.is_admin or p.hierarchy_level in ('DIRECTOR', 'ADMIN'))
  );
$$;

-- ---------------------------------------------------------------------------
-- Escopo hierárquico (AUTHORIZATION.md §3)
-- ---------------------------------------------------------------------------

-- IDs de perfis visíveis ao usuário atual, sempre incluindo o próprio.
-- USER: próprio. LEADER: próprio + USER subordinados diretos.
-- COORDINATOR/MANAGER: próprio + árvore abaixo (recursiva, protegida contra ciclos).
-- DIRECTOR/ADMIN: todos.
-- Subordinados inativos continuam no escopo para que sua carteira não fique órfã.
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
    where p.user_id = auth.uid()
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

-- E-mails normalizados dos perfis no escopo; base do RLS de legal_clients.
create or replace function public.legal_scope_emails()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select p.email
  from public.legal_profiles p
  where p.id in (select public.legal_get_user_scope());
$$;

create or replace function public.legal_can_access_client(client_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.legal_clients c
    where c.id = client_uuid
      and (
        public.legal_has_global_scope()
        or c.legalization_responsible_email in (select public.legal_scope_emails())
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Validação da hierarquia (AUTHORIZATION.md §4)
-- ---------------------------------------------------------------------------

create or replace function public.legal_profiles_validate_hierarchy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_manager public.legal_profiles;
begin
  if new.manager_id is not null then
    if new.hierarchy_level = 'ADMIN' then
      raise exception 'Perfil ADMIN não participa da árvore operacional'
        using errcode = 'check_violation';
    end if;

    select * into v_manager
    from public.legal_profiles
    where id = new.manager_id;

    if not v_manager.active then
      raise exception 'O gestor informado está inativo'
        using errcode = 'check_violation';
    end if;

    if v_manager.hierarchy_level = 'ADMIN' then
      raise exception 'Perfil ADMIN não pode ser gestor na árvore operacional'
        using errcode = 'check_violation';
    end if;

    if v_manager.hierarchy_level <= new.hierarchy_level then
      raise exception 'O gestor precisa ter nível hierárquico acima do subordinado'
        using errcode = 'check_violation';
    end if;

    if exists (
      with recursive up (id, path) as (
        select new.manager_id, array[new.manager_id]
        union all
        select p.manager_id, up.path || p.manager_id
        from public.legal_profiles p
        join up on p.id = up.id
        where p.manager_id is not null
          and not p.manager_id = any (up.path)
      )
      select 1 from up where up.id = new.id
    ) then
      raise exception 'A alteração criaria um ciclo na hierarquia'
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.hierarchy_level is distinct from old.hierarchy_level then
    if exists (
      select 1
      from public.legal_profiles child
      where child.manager_id = new.id
        and (new.hierarchy_level = 'ADMIN' or child.hierarchy_level >= new.hierarchy_level)
    ) then
      raise exception 'O novo nível é incompatível com os subordinados atuais'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists legal_profiles_validate_hierarchy on public.legal_profiles;
create trigger legal_profiles_validate_hierarchy
  before insert or update of manager_id, hierarchy_level on public.legal_profiles
  for each row execute function public.legal_profiles_validate_hierarchy();

-- ---------------------------------------------------------------------------
-- Integridade dos vencimentos
-- ---------------------------------------------------------------------------

-- Deriva autoria da sessão e protege a cadeia de renovações.
-- Mudanças para RENEWED e inserções com previous_expiration_id só ocorrem
-- dentro de legal_complete_renewal, que liga o contexto 'legal.renewal_context'
-- apenas durante a própria transação.
create or replace function public.legal_expirations_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_profile_id uuid := public.legal_current_profile_id();
  v_in_renewal boolean := coalesce(current_setting('legal.renewal_context', true), '') = 'on';
begin
  if v_profile_id is null then
    raise exception 'ACCESS DENIED: perfil ativo obrigatório'
      using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := v_profile_id;
    new.updated_by := v_profile_id;
    new.created_at := now();
    new.updated_at := now();
    new.deleted_at := null;
    new.renewed_at := null;

    if not v_in_renewal then
      if new.status <> 'ACTIVE' then
        raise exception 'Um novo vencimento deve iniciar como ACTIVE'
          using errcode = 'check_violation';
      end if;
      if new.previous_expiration_id is not null then
        raise exception 'Renovações devem ser concluídas por legal_complete_renewal'
          using errcode = 'check_violation';
      end if;
    end if;

    return new;
  end if;

  if new.id <> old.id
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at
    or new.previous_expiration_id is distinct from old.previous_expiration_id
  then
    raise exception 'Campos de identidade, autoria e cadeia de renovação são imutáveis'
      using errcode = 'check_violation';
  end if;

  if not v_in_renewal then
    if old.status = 'RENEWED' then
      raise exception 'Vencimento renovado faz parte do histórico e não pode ser alterado'
        using errcode = 'check_violation';
    end if;
    if new.status = 'RENEWED' or new.renewed_at is distinct from old.renewed_at then
      raise exception 'Renovações devem ser concluídas por legal_complete_renewal'
        using errcode = 'check_violation';
    end if;
  end if;

  new.updated_by := v_profile_id;
  return new;
end;
$$;

drop trigger if exists legal_expirations_before_write on public.legal_expirations;
create trigger legal_expirations_before_write
  before insert or update on public.legal_expirations
  for each row execute function public.legal_expirations_before_write();

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER: usuários não têm INSERT em legal_audit_logs; somente este
-- trigger grava. Funções de trigger não podem ser chamadas diretamente.
create or replace function public.legal_expirations_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := case
      when new.previous_expiration_id is null then 'EXPIRATION_CREATED'
      else 'EXPIRATION_RENEWAL_CREATED'
    end;
  else
    v_action := case
      when new.deleted_at is not null and old.deleted_at is null then 'EXPIRATION_DELETED'
      when new.status is distinct from old.status then
        case new.status
          when 'RENEWING' then 'EXPIRATION_RENEWAL_STARTED'
          when 'RENEWED' then 'EXPIRATION_RENEWED'
          when 'CANCELLED' then 'EXPIRATION_CANCELLED'
          else 'EXPIRATION_STATUS_CHANGED'
        end
      when new.responsible_user_id is distinct from old.responsible_user_id
        then 'EXPIRATION_RESPONSIBLE_CHANGED'
      else 'EXPIRATION_UPDATED'
    end;
  end if;

  insert into public.legal_audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    public.legal_current_profile_id(),
    v_action,
    'legal_expirations',
    new.id,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new)
  );

  return null;
end;
$$;

drop trigger if exists legal_expirations_audit on public.legal_expirations;
create trigger legal_expirations_audit
  after insert or update on public.legal_expirations
  for each row execute function public.legal_expirations_audit();

-- ---------------------------------------------------------------------------
-- Renovação atômica (DATABASE.md §6)
-- ---------------------------------------------------------------------------

-- SECURITY INVOKER: o RLS do chamador limita o vencimento que pode ser renovado.
-- Payload: expiration_date (obrigatório, YYYY-MM-DD); issue_date, document_name,
-- document_number, issuer e notes opcionais. Cliente, tipo e responsável são
-- herdados do vencimento anterior.
create or replace function public.legal_complete_renewal(old_id uuid, payload jsonb)
returns public.legal_expirations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old public.legal_expirations;
  v_new public.legal_expirations;
  v_expiration_date date;
  v_issue_date date;
begin
  if public.legal_current_profile_id() is null then
    raise exception 'ACCESS DENIED: perfil ativo obrigatório'
      using errcode = 'insufficient_privilege';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'Payload da renovação inválido' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_old
  from public.legal_expirations
  where id = old_id
    and deleted_at is null
  for update;

  -- Não distingue "inexistente" de "fora do escopo" para não vazar dados.
  if not found then
    raise exception 'Vencimento não encontrado' using errcode = 'no_data_found';
  end if;

  if v_old.status <> 'RENEWING' then
    raise exception 'O vencimento precisa estar em renovação para ser concluído'
      using errcode = 'check_violation';
  end if;

  begin
    v_expiration_date := (payload ->> 'expiration_date')::date;
    v_issue_date := nullif(payload ->> 'issue_date', '')::date;
  exception when others then
    raise exception 'Data inválida no payload da renovação'
      using errcode = 'invalid_datetime_format';
  end;

  if v_expiration_date is null then
    raise exception 'A nova data de vencimento é obrigatória'
      using errcode = 'not_null_violation';
  end if;

  perform set_config('legal.renewal_context', 'on', true);

  update public.legal_expirations
  set status = 'RENEWED',
      renewed_at = now()
  where id = v_old.id;

  insert into public.legal_expirations (
    client_id, expiration_type, document_name, document_number, issuer,
    issue_date, expiration_date, responsible_user_id, status, notes,
    previous_expiration_id
  ) values (
    v_old.client_id,
    v_old.expiration_type,
    coalesce(nullif(btrim(payload ->> 'document_name'), ''), v_old.document_name),
    case when payload ? 'document_number'
      then nullif(btrim(payload ->> 'document_number'), '')
      else v_old.document_number end,
    case when payload ? 'issuer'
      then nullif(btrim(payload ->> 'issuer'), '')
      else v_old.issuer end,
    v_issue_date,
    v_expiration_date,
    v_old.responsible_user_id,
    'ACTIVE',
    nullif(btrim(payload ->> 'notes'), ''),
    v_old.id
  )
  returning * into v_new;

  perform set_config('legal.renewal_context', 'off', true);

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- updated_at nas demais tabelas
-- ---------------------------------------------------------------------------

drop trigger if exists legal_profiles_set_updated_at on public.legal_profiles;
create trigger legal_profiles_set_updated_at
  before update on public.legal_profiles
  for each row execute function public.legal_set_updated_at();

drop trigger if exists legal_clients_set_updated_at on public.legal_clients;
create trigger legal_clients_set_updated_at
  before update on public.legal_clients
  for each row execute function public.legal_set_updated_at();

drop trigger if exists legal_acessorias_users_set_updated_at on public.legal_acessorias_users;
create trigger legal_acessorias_users_set_updated_at
  before update on public.legal_acessorias_users
  for each row execute function public.legal_set_updated_at();

drop trigger if exists legal_expirations_set_updated_at on public.legal_expirations;
create trigger legal_expirations_set_updated_at
  before update on public.legal_expirations
  for each row execute function public.legal_set_updated_at();

drop trigger if exists legal_settings_set_updated_at on public.legal_settings;
create trigger legal_settings_set_updated_at
  before update on public.legal_settings
  for each row execute function public.legal_set_updated_at();
