-- legal_019 — legal_can_assign_responsible só responde para quem tem perfil
-- ativo (sessão Microsoft) e acesso ao cliente. Antes, qualquer usuário
-- autenticado do projeto compartilhado podia chamá-la por RPC e descobrir se
-- um perfil é responsável por um cliente fora do seu escopo (revisão de
-- segurança de 16/10/2026). O EXECUTE continua concedido: o trigger de
-- legal_expirations roda como o usuário e depende da função.
-- Idempotente. Rollback: reaplicar a definição de legal_016.

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
  select public.legal_current_profile_id() is not null
    and public.legal_can_access_client(client_uuid)
    and exists (
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
