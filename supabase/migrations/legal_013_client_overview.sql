-- legal_013 — Visão de clientes com agregados de vencimentos (tela Meus Clientes).
-- security_invoker: a view roda com as permissões de quem consulta, então o
-- RLS de legal_clients e legal_expirations continua valendo.
-- Idempotente (create or replace). Rollback: drop view public.legal_client_overview.

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
      where e.status in ('ACTIVE', 'RENEWING')
    ) as active_expirations,
    count(*) filter (
      where (e.status = 'ACTIVE' and e.expiration_date < today.d)
         or e.status = 'EXPIRED'
    ) as overdue_expirations,
    min(e.expiration_date) filter (
      where e.status in ('ACTIVE', 'RENEWING') and e.expiration_date >= today.d
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
