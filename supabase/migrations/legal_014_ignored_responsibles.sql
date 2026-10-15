-- legal_014 — Responsáveis desconsiderados na carteira da Legalização.
-- Decisão do responsável em 15/10/2026: Evelin, Mariane e Monise não são
-- consideradas responsáveis quando aparecem nos departamentos 5/13 do
-- Acessórias. A comparação é por e-mail normalizado.
-- Idempotente (não sobrescreve ajustes posteriores).
-- Rollback: delete from public.legal_settings
--           where key = 'acessorias_ignored_responsible_emails';

insert into public.legal_settings (key, value, description) values
  (
    'acessorias_ignored_responsible_emails',
    '[
      "evelincarlini.comercial@escritoriologica.com.br",
      "marianes.fiscal@escritoriologica.com.br",
      "monise.legalizacao@escritoriologica.com.br"
    ]',
    'E-mails desconsiderados como responsáveis da Legalização na sincronização.'
  )
on conflict (key) do nothing;
