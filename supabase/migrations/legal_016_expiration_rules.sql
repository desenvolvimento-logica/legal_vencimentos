-- legal_016 — Regras de ciclo de vida dos vencimentos (decisões de 16/10/2026).
--
-- * Situações: ACTIVE → RENEWING (iniciar renovação) → RENEWED (só por
--   legal_complete_renewal); RENEWING → ACTIVE (desistir); ACTIVE/RENEWING →
--   CANCELLED com motivo. RENEWED e CANCELLED são finais. EXPIRED nunca é
--   gravado pela aplicação (é situação exibida, calculada pela data).
-- * Data de vencimento pode ser corrigida em registros ACTIVE (auditado).
-- * Cancelar e excluir (logicamente): qualquer usuário com acesso ao cliente.
-- * Responsável: perfil ativo do escopo de quem grava ou responsável do
--   cliente no Acessórias (departamentos 5/13); o padrão vem da carteira.
--
-- Idempotente. Rollback: reaplicar as funções de legal_006; a coluna
-- cancellation_reason pode permanecer (nula) sem efeito.

alter table public.legal_expirations
  add column if not exists cancellation_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'legal_expirations_cancellation_reason_check'
  ) then
    alter table public.legal_expirations
      add constraint legal_expirations_cancellation_reason_check
      check (
        (status = 'CANCELLED') = (cancellation_reason is not null)
        and (cancellation_reason is null or char_length(btrim(cancellation_reason)) between 1 and 500)
      );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Responsáveis atribuíveis
-- ---------------------------------------------------------------------------

-- Perfil pode ser responsável por um vencimento do cliente se estiver ativo e
-- (a) no escopo de quem grava ou (b) for responsável do cliente no Acessórias.
create or replace function public.legal_can_assign_responsible(
  client_uuid uuid,
  profile_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.legal_profiles p
    where p.id = profile_uuid
      and p.active
      and (
        p.id in (select public.legal_get_user_scope())
        or p.email in (
          select r.responsible_email
          from public.legal_client_responsibles r
          where r.client_id = client_uuid
        )
      )
  );
$$;

-- Perfis que o usuário pode ver por nome: seu escopo, responsáveis dos
-- clientes visíveis e responsáveis de vencimentos visíveis. Só os campos
-- necessários à interface (AUTHORIZATION.md §7, legal_profiles).
create or replace function public.legal_visible_profiles()
returns table (
  id uuid,
  name text,
  email text,
  hierarchy_level public.legal_hierarchy_level,
  active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.email, p.hierarchy_level, p.active
  from public.legal_profiles p
  where p.id in (select public.legal_get_user_scope())
     or p.email in (
       select r.responsible_email
       from public.legal_client_responsibles r
       where r.client_id in (select public.legal_visible_client_ids())
     )
     or p.id in (
       select e.responsible_user_id
       from public.legal_expirations e
       where e.client_id in (select public.legal_visible_client_ids())
     );
$$;

-- ---------------------------------------------------------------------------
-- Integridade dos vencimentos (substitui a versão de legal_006)
-- ---------------------------------------------------------------------------

create or replace function public.legal_expirations_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_profile_id uuid := public.legal_current_profile_id();
  v_in_renewal boolean := coalesce(current_setting('legal.renewal_context', true), '') = 'on';
  v_in_delete boolean := coalesce(current_setting('legal.delete_context', true), '') = 'on';
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
    new.cancellation_reason := null;

    if not v_in_renewal then
      if new.status <> 'ACTIVE' then
        raise exception 'Um novo vencimento deve iniciar como ACTIVE'
          using errcode = 'check_violation';
      end if;
      if new.previous_expiration_id is not null then
        raise exception 'Renovações devem ser concluídas por legal_complete_renewal'
          using errcode = 'check_violation';
      end if;
      if new.responsible_user_id is not null
        and not public.legal_can_assign_responsible(new.client_id, new.responsible_user_id)
      then
        raise exception 'Responsável fora do escopo permitido para este cliente'
          using errcode = 'check_violation';
      end if;
    end if;

    return new;
  end if;

  if new.id <> old.id
    or new.client_id <> old.client_id
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at
    or new.previous_expiration_id is distinct from old.previous_expiration_id
  then
    raise exception 'Cliente, identidade, autoria e cadeia de renovação são imutáveis'
      using errcode = 'check_violation';
  end if;

  if not v_in_renewal then
    if old.deleted_at is not null then
      raise exception 'Vencimento excluído não pode ser alterado'
        using errcode = 'check_violation';
    end if;
    if old.status in ('RENEWED', 'CANCELLED') then
      raise exception 'Vencimento renovado ou cancelado faz parte do histórico e não pode ser alterado'
        using errcode = 'check_violation';
    end if;
    if new.status = 'RENEWED' or new.renewed_at is distinct from old.renewed_at then
      raise exception 'Renovações devem ser concluídas por legal_complete_renewal'
        using errcode = 'check_violation';
    end if;
    if new.deleted_at is distinct from old.deleted_at and not v_in_delete then
      raise exception 'Exclusões devem ser feitas por legal_delete_expiration'
        using errcode = 'check_violation';
    end if;

    if new.status <> old.status
      and (old.status, new.status) not in (
        ('ACTIVE'::public.legal_expiration_status, 'RENEWING'::public.legal_expiration_status),
        ('RENEWING', 'ACTIVE'),
        ('ACTIVE', 'CANCELLED'),
        ('RENEWING', 'CANCELLED')
      )
    then
      raise exception 'Mudança de situação não permitida: % → %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    if new.cancellation_reason is distinct from old.cancellation_reason
      and new.status <> 'CANCELLED'
    then
      raise exception 'O motivo só é informado ao cancelar'
        using errcode = 'check_violation';
    end if;

    if new.expiration_date <> old.expiration_date
      and not (old.status = 'ACTIVE' and new.status = 'ACTIVE')
    then
      raise exception 'A data de vencimento só pode ser corrigida em registros ativos'
        using errcode = 'check_violation';
    end if;

    if new.responsible_user_id is distinct from old.responsible_user_id
      and new.responsible_user_id is not null
      and not public.legal_can_assign_responsible(new.client_id, new.responsible_user_id)
    then
      raise exception 'Responsável fora do escopo permitido para este cliente'
        using errcode = 'check_violation';
    end if;
  end if;

  new.updated_by := v_profile_id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auditoria (substitui a versão de legal_006; acrescenta desistência)
-- ---------------------------------------------------------------------------

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
        case
          when new.status = 'RENEWING' then 'EXPIRATION_RENEWAL_STARTED'
          when new.status = 'RENEWED' then 'EXPIRATION_RENEWED'
          when new.status = 'CANCELLED' then 'EXPIRATION_CANCELLED'
          when old.status = 'RENEWING' and new.status = 'ACTIVE' then 'EXPIRATION_RENEWAL_ABANDONED'
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

-- ---------------------------------------------------------------------------
-- Exclusão lógica
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER: a policy de SELECT exige deleted_at IS NULL, o que
-- impediria o UPDATE com RETURNING. O acesso ao cliente é verificado aqui.
create or replace function public.legal_delete_expiration(expiration_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expiration public.legal_expirations;
begin
  if public.legal_current_profile_id() is null then
    raise exception 'ACCESS DENIED: perfil ativo obrigatório'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_expiration
  from public.legal_expirations
  where id = expiration_id
    and deleted_at is null
  for update;

  if not found or not public.legal_can_access_client(v_expiration.client_id) then
    raise exception 'Vencimento não encontrado' using errcode = 'no_data_found';
  end if;

  if v_expiration.status = 'RENEWED'
    or exists (
      select 1 from public.legal_expirations s
      where s.previous_expiration_id = v_expiration.id and s.deleted_at is null
    )
  then
    raise exception 'Vencimento que faz parte de uma cadeia de renovação não pode ser excluído'
      using errcode = 'check_violation';
  end if;

  perform set_config('legal.delete_context', 'on', true);
  update public.legal_expirations
  set deleted_at = now()
  where id = v_expiration.id;
  perform set_config('legal.delete_context', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------------

revoke all on function
  public.legal_can_assign_responsible(uuid, uuid),
  public.legal_visible_profiles(),
  public.legal_delete_expiration(uuid)
from public, anon, authenticated;

grant execute on function
  public.legal_can_assign_responsible(uuid, uuid),
  public.legal_visible_profiles(),
  public.legal_delete_expiration(uuid)
to authenticated, service_role;
