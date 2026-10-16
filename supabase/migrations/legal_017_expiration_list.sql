-- legal_017 — Visão de vencimentos com dados do cliente (tela Vencimentos).
-- security_invoker: o RLS de legal_expirations (deleted_at IS NULL e cliente
-- visível) e de legal_clients continua valendo para quem consulta.
-- search_text reúne os campos buscáveis para um único filtro ILIKE, sem
-- montar filtros OR a partir do texto digitado.
-- Idempotente. Rollback: drop view public.legal_expiration_list.

create or replace view public.legal_expiration_list
with (security_invoker = true)
as
select
  e.id,
  e.client_id,
  e.expiration_type,
  e.document_name,
  e.document_number,
  e.issuer,
  e.issue_date,
  e.expiration_date,
  e.status,
  e.responsible_user_id,
  e.notes,
  e.cancellation_reason,
  c.corporate_name as client_name,
  c.trade_name as client_trade_name,
  c.document_number as client_document_number,
  lower(concat_ws(
    ' ',
    c.corporate_name,
    c.trade_name,
    c.document_number,
    regexp_replace(coalesce(c.document_number, ''), '\D', '', 'g'),
    e.document_name,
    e.document_number
  )) as search_text
from public.legal_expirations e
join public.legal_clients c on c.id = e.client_id;

comment on view public.legal_expiration_list is
  'Controle de Vencimentos (Legalização): vencimentos visíveis com dados do cliente.';

revoke all on table public.legal_expiration_list from anon, authenticated;
grant select on table public.legal_expiration_list to authenticated;
