-- legal_022 — Regras da situação "Orçamento enviado" (decisão de 16/10/2026).
--
-- Requer legal_021 aplicada e confirmada antes (valor novo de enum).
--
-- * Fluxo: ACTIVE → QUOTE_SENT (orçamento enviado ao cliente) → RENEWING
--   → RENEWED. De QUOTE_SENT também volta a ACTIVE (cliente recusou) ou vai
--   a CANCELLED. A data do vencimento só muda em ACTIVE (legal_016).
-- * quote_sent_at: gravada pelo trigger ao entrar em QUOTE_SENT; não é
--   editável e fica preservada nas etapas seguintes.
-- * Auditoria: EXPIRATION_QUOTE_SENT e EXPIRATION_QUOTE_WITHDRAWN.
-- * QUOTE_SENT conta como vigente na visão de clientes e nos lembretes.
--
-- Idempotente. Rollback: reaplicar as funções de legal_016, a view de
-- legal_013 e o índice de legal_020; remover a coluna quote_sent_at.

alter table public.legal_expirations
  add column if not exists quote_sent_at timestamptz;

-- ---------------------------------------------------------------------------
-- Integridade dos vencimentos (substitui a versão de legal_016)
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
    new.quote_sent_at := null;

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
        ('RENEWING', 'CANCELLED'),
        ('ACTIVE', 'QUOTE_SENT'),
        ('QUOTE_SENT', 'ACTIVE'),
        ('QUOTE_SENT', 'RENEWING'),
        ('QUOTE_SENT', 'CANCELLED')
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

  -- Data de envio do orçamento: gravada pelo banco ao entrar em QUOTE_SENT
  -- e preservada depois (não é editável).
  if new.status = 'QUOTE_SENT' and old.status <> 'QUOTE_SENT' then
    new.quote_sent_at := now();
  else
    new.quote_sent_at := old.quote_sent_at;
  end if;

  new.updated_by := v_profile_id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auditoria (substitui a versão de legal_016)
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
          when new.status = 'QUOTE_SENT' then 'EXPIRATION_QUOTE_SENT'
          when new.status = 'RENEWING' then 'EXPIRATION_RENEWAL_STARTED'
          when new.status = 'RENEWED' then 'EXPIRATION_RENEWED'
          when new.status = 'CANCELLED' then 'EXPIRATION_CANCELLED'
          when old.status = 'RENEWING' and new.status = 'ACTIVE' then 'EXPIRATION_RENEWAL_ABANDONED'
          when old.status = 'QUOTE_SENT' and new.status = 'ACTIVE' then 'EXPIRATION_QUOTE_WITHDRAWN'
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
-- Vigentes incluem QUOTE_SENT
-- ---------------------------------------------------------------------------

-- Lembretes (legal_020): o índice parcial precisa do mesmo filtro da consulta.
create index if not exists legal_expirations_reminder_current_idx
  on public.legal_expirations (responsible_user_id, reminder_date)
  where deleted_at is null
    and reminder_date is not null
    and status in ('ACTIVE', 'QUOTE_SENT', 'RENEWING');

drop index if exists public.legal_expirations_reminder_idx;

-- Mesmas colunas de legal_013; só o filtro de vigentes muda.
create or replace view public.legal_client_overview
with (security_invoker = true)
as
with today as (
  select (now() at time zone 'America/Sao_Paulo')::date as d
),
expiration_stats as (
  select
    e.client_id,
    count(*) filter (
      where e.status in ('ACTIVE', 'QUOTE_SENT', 'RENEWING')
    ) as active_expirations,
    count(*) filter (
      where (e.status = 'ACTIVE' and e.expiration_date < today.d)
         or e.status = 'EXPIRED'
    ) as overdue_expirations,
    min(e.expiration_date) filter (
      where e.status in ('ACTIVE', 'QUOTE_SENT', 'RENEWING') and e.expiration_date >= today.d
    ) as next_expiration_date
  from public.legal_expirations e
  cross join today
  where e.deleted_at is null
  group by e.client_id
)
select
  c.id,
  c.acessorias_company_id,
  c.corporate_name,
  c.trade_name,
  c.document_number,
  -- Só dígitos, para buscar CNPJ/CPF com ou sem pontuação.
  regexp_replace(coalesce(c.document_number, ''), '\D', '', 'g') as document_digits,
  c.status,
  c.legalization_responsible_name,
  c.legalization_responsible_email,
  (
    select r.responsible_name
    from public.legal_client_responsibles r
    where r.client_id = c.id and r.department_id <> coalesce(c.legalization_department_id, '')
    order by r.department_id
    limit 1
  ) as other_responsible_name,
  coalesce(s.active_expirations, 0)::integer as active_expirations,
  coalesce(s.overdue_expirations, 0)::integer as overdue_expirations,
  s.next_expiration_date
from public.legal_clients c
left join expiration_stats s on s.client_id = c.id;

comment on view public.legal_client_overview is
  'Controle de Vencimentos (Legalização): clientes visíveis com agregados de vencimentos.';

revoke all on table public.legal_client_overview from anon, authenticated;
grant select on table public.legal_client_overview to authenticated;
