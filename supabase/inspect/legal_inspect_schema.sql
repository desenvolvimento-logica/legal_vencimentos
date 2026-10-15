-- Inspeção somente leitura do projeto Supabase compartilhado.
-- Executar no SQL Editor antes de criar migrations e devolver o resultado.
-- Retorna uma única célula JSON para facilitar a cópia. Não altera nenhum objeto.

select jsonb_pretty(jsonb_build_object(
  'postgres_version', current_setting('server_version'),

  -- Extensões instaladas (pgcrypto/gen_random_uuid, pg_trgm para busca).
  'extensions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', e.extname, 'schema', n.nspname, 'version', e.extversion
    ) order by e.extname), '[]')
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
  ),

  -- Objetos já existentes com o prefixo deste sistema (esperado: vazio).
  'legal_relations', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', n.nspname || '.' || c.relname, 'kind', c.relkind::text
    ) order by n.nspname, c.relname), '[]')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relname like 'legal\_%'
  ),
  'legal_types', (
    select coalesce(jsonb_agg(n.nspname || '.' || t.typname order by n.nspname, t.typname), '[]')
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname like 'legal\_%'
  ),
  'legal_functions', (
    select coalesce(jsonb_agg(
      n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      order by n.nspname, p.proname), '[]')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname like 'legal\_%'
  ),

  -- Prefixos usados pelos outros sistemas no schema public.
  'public_table_prefixes', (
    select coalesce(jsonb_object_agg(prefix, total), '{}')
    from (
      select split_part(c.relname, '_', 1) as prefix, count(*) as total
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      group by 1
    ) s
  ),

  -- Schemas não padrão existentes.
  'schemas', (
    select coalesce(jsonb_agg(n.nspname order by n.nspname), '[]')
    from pg_namespace n
    where n.nspname not like 'pg\_%' and n.nspname <> 'information_schema'
  ),

  -- Usuário admin inicial (somente id e confirmação, sem outros dados).
  'admin_auth_user', (
    select jsonb_build_object(
      'id', u.id, 'email_confirmed', u.email_confirmed_at is not null
    )
    from auth.users u
    where lower(trim(u.email)) = 'desenvolvimento@escritoriologica.com.br'
  ),

  -- Tabelas de histórico de migrations da CLI, se existirem.
  'migration_tables', (
    select coalesce(jsonb_agg(table_schema || '.' || table_name order by table_name), '[]')
    from information_schema.tables
    where table_schema = 'supabase_migrations'
  )
)) as result;
