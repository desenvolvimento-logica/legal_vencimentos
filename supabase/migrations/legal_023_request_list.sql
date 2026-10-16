-- legal_023 — Visão de solicitações com dados do cliente (tela Solicitações).
--
-- security_invoker: o RLS de legal_acessorias_requests (cliente visível) e
-- de legal_clients continua valendo para quem consulta. search_text reúne
-- os campos buscáveis para um único filtro ILIKE, sem montar filtros OR a
-- partir do texto digitado (mesmo padrão de legal_017).
--
-- Idempotente. Rollback: drop view public.legal_request_list.

create or replace view public.legal_request_list
with (security_invoker = true)
as
select
  r.id,
  r.acessorias_request_id,
  r.acessorias_company_id,
  r.request_type,
  r.subject,
  r.priority,
  r.status,
  r.office_responsibles,
  r.opened_at,
  r.due_at,
  r.last_update_at,
  r.completed_at,
  c.id as client_id,
  c.corporate_name as client_name,
  c.document_number as client_document_number,
  lower(concat_ws(
    ' ',
    r.acessorias_request_id,
    r.subject,
    c.corporate_name,
    c.trade_name,
    c.document_number,
    regexp_replace(coalesce(c.document_number, ''), '\D', '', 'g')
  )) as search_text
from public.legal_acessorias_requests r
join public.legal_clients c on c.acessorias_company_id = r.acessorias_company_id;

comment on view public.legal_request_list is
  'Controle de Vencimentos (Legalização): solicitações visíveis com dados do cliente.';

revoke all on table public.legal_request_list from anon, authenticated;
grant select on table public.legal_request_list to authenticated;
