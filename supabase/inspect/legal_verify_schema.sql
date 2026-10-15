-- Verificação somente leitura após aplicar as migrations legal_.
-- Retorna uma única célula JSON. Não altera nenhum objeto.

select jsonb_pretty(jsonb_build_object(
  -- Tabelas legal_ com RLS e número de policies (esperado: rls = true em todas).
  'tables', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'rls', c.relrowsecurity,
      'policies', (
        select count(*) from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname
      )
    ) order by c.relname), '[]')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'legal\_%'
  ),

  -- Privilégios de tabela do papel anon (esperado: vazio).
  'anon_table_grants', (
    select coalesce(jsonb_agg(table_name || ':' || privilege_type
      order by table_name, privilege_type), '[]')
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon' and table_name like 'legal\_%'
  ),

  -- Privilégios de tabela do papel authenticated (esperado: SELECT; INSERT/UPDATE só em expirations).
  'authenticated_table_grants', (
    select coalesce(jsonb_object_agg(table_name, privileges), '{}')
    from (
      select table_name, jsonb_agg(privilege_type order by privilege_type) as privileges
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'authenticated' and table_name like 'legal\_%'
      group by table_name
    ) g
  ),

  -- Funções legal_: SECURITY DEFINER, search_path fixo e quem pode executar.
  'functions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'security_definer', p.prosecdef,
      'config', p.proconfig,
      'anon_can_execute', has_function_privilege('anon', p.oid, 'execute'),
      'authenticated_can_execute', has_function_privilege('authenticated', p.oid, 'execute')
    ) order by p.proname), '[]')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'legal\_%'
  ),

  'triggers', (
    select coalesce(jsonb_agg(c.relname || '.' || t.tgname order by c.relname, t.tgname), '[]')
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where not t.tgisinternal and c.relname like 'legal\_%'
  ),

  'types', (
    select coalesce(jsonb_object_agg(t.typname, (
      select jsonb_agg(e.enumlabel order by e.enumsortorder)
      from pg_enum e where e.enumtypid = t.oid
    )), '{}')
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname like 'legal\_%' and t.typtype = 'e'
  ),

  'settings_keys', (
    select coalesce(jsonb_agg(key order by key), '[]') from public.legal_settings
  ),

  -- Perfil ADMIN inicial (sem dados pessoais além do nível).
  'admin_profile', (
    select jsonb_build_object(
      'hierarchy_level', p.hierarchy_level,
      'is_admin', p.is_admin,
      'active', p.active
    )
    from public.legal_profiles p
    where p.email = 'desenvolvimento@escritoriologica.com.br'
  )
)) as result;
