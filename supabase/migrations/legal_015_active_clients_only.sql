-- legal_015 — Somente clientes ativos no Acessórias aparecem no sistema.
-- Decisão do responsável em 15/10/2026. A sincronização continua trazendo
-- todas as empresas (inclusive inativas) para registrar mudanças de situação;
-- o filtro fica no escopo, então vale para listas, detalhe, solicitações e
-- vencimentos, para todos os níveis (inclusive DIRECTOR/ADMIN).
-- Idempotente. Rollback: reaplicar legal_visible_client_ids de legal_011.

create or replace function public.legal_visible_client_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.legal_clients c
  where c.status = 'Ativa'
    and public.legal_has_global_scope()
  union
  select r.client_id
  from public.legal_client_responsibles r
  join public.legal_clients c on c.id = r.client_id
  where c.status = 'Ativa'
    and r.responsible_email in (select public.legal_scope_emails());
$$;
