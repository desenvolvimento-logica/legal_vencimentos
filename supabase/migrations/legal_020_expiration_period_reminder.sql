-- legal_020 — Periodicidade de renovação e lembrete por vencimento
-- (decisões de 16/10/2026).
--
-- - renewal_period: com periodicidade, o vencimento é sempre emissão +
--   período (calculado pelo trigger legal_expirations_apply_period; a emissão
--   passa a ser obrigatória). Sem periodicidade, a data continua manual.
-- - reminder_days: lembrete X dias antes do vencimento; reminder_date é a
--   data a partir da qual o lembrete aparece para o responsável.
-- - legal_complete_renewal copia periodicidade e lembrete para o novo
--   registro; com periodicidade, o novo período conta da data de conclusão
--   (emissão = hoje em America/Sao_Paulo) e a data informada é ignorada.
--
-- Idempotente. Rollback: remover o trigger legal_expirations_apply_period,
-- as funções legal_renewal_period_months/legal_period_expiration_date, as
-- colunas reminder_date/reminder_days/renewal_period, o tipo
-- legal_renewal_period e reaplicar legal_complete_renewal de legal_006.
-- A view legal_expiration_list (legal_017) não muda: reaplicar legal_017
-- com colunas a mais falharia; a tela busca os campos novos na tabela.

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'legal_renewal_period'
  ) then
    create type public.legal_renewal_period as enum (
      'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'
    );
  end if;
end;
$$;

alter table public.legal_expirations
  add column if not exists renewal_period public.legal_renewal_period,
  add column if not exists reminder_days smallint,
  add column if not exists reminder_date date
    generated always as (expiration_date - reminder_days) stored;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'legal_expirations_reminder_days_check'
      and conrelid = 'public.legal_expirations'::regclass
  ) then
    alter table public.legal_expirations
      add constraint legal_expirations_reminder_days_check
      check (reminder_days is null or reminder_days between 1 and 365);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'legal_expirations_period_issue_date_check'
      and conrelid = 'public.legal_expirations'::regclass
  ) then
    alter table public.legal_expirations
      add constraint legal_expirations_period_issue_date_check
      check (renewal_period is null or issue_date is not null);
  end if;
end;
$$;

-- Lembretes do responsável: vigentes cujo lembrete já começou.
create index if not exists legal_expirations_reminder_idx
  on public.legal_expirations (responsible_user_id, reminder_date)
  where deleted_at is null
    and reminder_date is not null
    and status in ('ACTIVE', 'RENEWING');

-- ---------------------------------------------------------------------------
-- Cálculo do vencimento pela periodicidade
-- ---------------------------------------------------------------------------

create or replace function public.legal_renewal_period_months(period public.legal_renewal_period)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case period
    when 'MONTHLY' then 1
    when 'BIMONTHLY' then 2
    when 'QUARTERLY' then 3
    when 'SEMIANNUAL' then 6
    when 'ANNUAL' then 12
  end;
$$;

-- Soma de meses do Postgres: fim de mês inexistente vira o último dia
-- (31/01 + 1 mês = 28/02). src/lib/expirations/period.ts replica a regra.
create or replace function public.legal_period_expiration_date(
  issue date,
  period public.legal_renewal_period
)
returns date
language sql
immutable
set search_path = ''
as $$
  select (issue + make_interval(months => public.legal_renewal_period_months(period)))::date;
$$;

-- Dispara antes de legal_expirations_before_write (ordem alfabética), que
-- então valida a data já calculada (ex.: só corrigível em registros ativos).
create or replace function public.legal_expirations_apply_period()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.renewal_period is not null and new.issue_date is not null then
    new.expiration_date := public.legal_period_expiration_date(new.issue_date, new.renewal_period);
  end if;
  return new;
end;
$$;

drop trigger if exists legal_expirations_apply_period on public.legal_expirations;
create trigger legal_expirations_apply_period
  before insert or update on public.legal_expirations
  for each row execute function public.legal_expirations_apply_period();

-- ---------------------------------------------------------------------------
-- Conclusão da renovação (substitui a versão de legal_006)
-- ---------------------------------------------------------------------------

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
  v_period public.legal_renewal_period;
  v_reminder_days smallint;
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
    v_expiration_date := nullif(payload ->> 'expiration_date', '')::date;
    v_issue_date := nullif(payload ->> 'issue_date', '')::date;
    v_period := case when payload ? 'renewal_period'
      then nullif(payload ->> 'renewal_period', '')::public.legal_renewal_period
      else v_old.renewal_period end;
    v_reminder_days := case when payload ? 'reminder_days'
      then nullif(payload ->> 'reminder_days', '')::smallint
      else v_old.reminder_days end;
  exception when others then
    raise exception 'Dados inválidos no payload da renovação'
      using errcode = 'invalid_parameter_value';
  end;

  if v_period is not null then
    -- O novo período conta da conclusão, salvo emissão informada.
    v_issue_date := coalesce(v_issue_date, (now() at time zone 'America/Sao_Paulo')::date);
    v_expiration_date := public.legal_period_expiration_date(v_issue_date, v_period);
  end if;

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
    previous_expiration_id, renewal_period, reminder_days
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
    case when payload ? 'notes'
      then nullif(btrim(payload ->> 'notes'), '')
      else v_old.notes end,
    v_old.id,
    v_period,
    v_reminder_days
  )
  returning * into v_new;

  perform set_config('legal.renewal_context', 'off', true);

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilégios (padrão de legal_007/legal_016)
-- ---------------------------------------------------------------------------

revoke all on function
  public.legal_renewal_period_months(public.legal_renewal_period),
  public.legal_period_expiration_date(date, public.legal_renewal_period),
  public.legal_expirations_apply_period()
from public, anon, authenticated;

-- O trigger roda como o usuário e chama o cálculo.
grant execute on function
  public.legal_renewal_period_months(public.legal_renewal_period),
  public.legal_period_expiration_date(date, public.legal_renewal_period)
to authenticated, service_role;
