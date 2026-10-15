-- Inspeção somente leitura: identidades do usuário ADMIN inicial e panorama
-- dos provedores em auth.users. Não expõe tokens nem dados pessoais além do
-- e-mail do próprio ADMIN. Retorna uma única célula JSON.

select jsonb_pretty(jsonb_build_object(
  -- Todos os registros de auth.users com o e-mail do ADMIN (esperado: 1).
  'admin_auth_users', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', u.id,
      'providers', u.raw_app_meta_data -> 'providers',
      'identities', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'provider', i.provider,
          'last_sign_in_at', i.last_sign_in_at
        ) order by i.provider), '[]')
        from auth.identities i
        where i.user_id = u.id
      ),
      'has_legal_profile', exists (
        select 1 from public.legal_profiles p where p.user_id = u.id
      )
    ) order by u.created_at), '[]')
    from auth.users u
    where lower(btrim(u.email)) = 'desenvolvimento@escritoriologica.com.br'
  ),

  -- Quantos usuários existem por provedor (sem identificar ninguém).
  'users_by_provider', (
    select coalesce(jsonb_object_agg(provider, total), '{}')
    from (
      select i.provider, count(distinct i.user_id) as total
      from auth.identities i
      group by i.provider
    ) s
  )
)) as result;
