-- Desempenho das consultas das telas, com RLS, simulando a sessão Microsoft
-- de um USER com a maior carteira e do ADMIN. Somente leitura: EXPLAIN ANALYZE
-- executa apenas SELECTs; a tabela temporária existe só nesta sessão.
-- Retorna uma única célula JSON.

create temp table if not exists legal_perf (
  who text, name text, total_ms numeric, planning_ms numeric, rows numeric, top_node text
) on commit preserve rows;
truncate legal_perf;

do $$
declare
  v_person record;
  v_query record;
  v_plan json;
  v_results jsonb := '[]';
  v_item jsonb;
begin
  for v_person in
    select 'USER (maior carteira)' as who, user_id
    from public.legal_profiles
    where email = 'jessicarodrigues.legalizacao@escritoriologica.com.br'
    union all
    select 'ADMIN', user_id
    from public.legal_profiles
    where email = 'desenvolvimento@escritoriologica.com.br'
  loop
    perform set_config(
      'request.jwt.claims',
      json_build_object(
        'sub', v_person.user_id,
        'role', 'authenticated',
        'amr', json_build_array(json_build_object('method', 'oauth', 'timestamp', 0)),
        'app_metadata', json_build_object('provider', 'azure', 'providers', json_build_array('azure'))
      )::text,
      true
    );
    execute 'set local role authenticated';

    for v_query in
      select * from (values
        ('escopo: legal_visible_client_ids', 'select count(*) from public.legal_visible_client_ids()'),
        ('clientes: contagem', 'select count(*) from public.legal_client_overview'),
        ('clientes: página 1', 'select id, corporate_name, active_expirations, next_expiration_date from public.legal_client_overview order by corporate_name, id limit 20'),
        ('clientes: busca por razão', $q$select id from public.legal_client_overview where corporate_name ilike '%ltda%' order by corporate_name limit 20$q$),
        ('clientes: busca por CNPJ', $q$select id from public.legal_client_overview where document_digits like '%0001%' order by corporate_name limit 20$q$),
        ('vencimentos: vigentes página 1', $q$select id from public.legal_expiration_list where status in ('ACTIVE','RENEWING') order by expiration_date, id limit 20$q$),
        ('vencimentos: busca', $q$select id from public.legal_expiration_list where search_text ilike '%alvar%' limit 20$q$),
        ('dashboard: vencidos', $q$select count(*) from public.legal_expiration_list where status = 'ACTIVE' and expiration_date < current_date$q$),
        ('dashboard: clientes', 'select count(*) from public.legal_clients'),
        ('responsáveis visíveis', 'select count(*) from public.legal_visible_profiles()'),
        ('solicitações de um cliente', $q$select id from public.legal_acessorias_requests where acessorias_company_id = (select acessorias_company_id from public.legal_acessorias_requests limit 1) order by last_update_at desc limit 20$q$)
      ) as t(name, sql)
    loop
      execute 'explain (analyze, format json) ' || v_query.sql into v_plan;
      v_item := jsonb_build_object(
        'who', v_person.who,
        'name', v_query.name,
        'total_ms', round(((v_plan -> 0 ->> 'Execution Time')::numeric + (v_plan -> 0 ->> 'Planning Time')::numeric), 2),
        'planning_ms', round((v_plan -> 0 ->> 'Planning Time')::numeric, 2),
        'rows', round((v_plan -> 0 -> 'Plan' ->> 'Actual Rows')::numeric),
        'top_node', v_plan -> 0 -> 'Plan' ->> 'Node Type'
      );
      v_results := v_results || v_item;
    end loop;

    execute 'reset role';
  end loop;

  insert into legal_perf (who, name, total_ms, planning_ms, rows, top_node)
  select r ->> 'who', r ->> 'name', (r ->> 'total_ms')::numeric, (r ->> 'planning_ms')::numeric,
         (r ->> 'rows')::numeric, r ->> 'top_node'
  from jsonb_array_elements(v_results) as r;
end
$$;

select jsonb_pretty(jsonb_agg(jsonb_build_object(
  'quem', who, 'consulta', name, 'ms', total_ms, 'planejamento_ms', planning_ms,
  'linhas', rows, 'nó', top_node
) order by who desc, name)) as result
from legal_perf;
