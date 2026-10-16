-- Manutenção: exclusão lógica de uma cadeia de renovação de TESTE.
--
-- Uso: SQL Editor do Supabase, uma execução. Troque o id em v_target pelo
-- vencimento RENEWED que ficou visível depois que o registro novo da
-- renovação foi excluído pelo app. Retorna uma única célula JSON.
--
-- O que faz:
-- * só aceita um registro RENEWED cujo sucessor já está excluído (cadeia
--   sem registro vigente); caso contrário, aborta sem alterar nada;
-- * marca deleted_at no registro e em todos os anteriores da cadeia
--   (exclusão lógica: nada é apagado fisicamente);
-- * age como o ADMIN (sessão Microsoft simulada), então a auditoria grava
--   EXPIRATION_DELETED com autoria.
--
-- Usa o contexto de renovação (legal.renewal_context) para passar pela
-- regra que congela registros RENEWED; só o SQL Editor (postgres) roda isto.
-- Não usar em dados reais: o histórico de renovações deve ser preservado.

create temp table if not exists legal_cleanup_result (
  id uuid, documento text, status text, excluido_em timestamptz
) on commit preserve rows;
truncate legal_cleanup_result;

do $$
declare
  v_target uuid := 'dfb526a6-3fb9-46d4-b16d-ef740964e54f';
  v_admin_email text := 'desenvolvimento@escritoriologica.com.br';
  v_admin_user uuid;
  v_current public.legal_expirations;
  v_ids uuid[] := '{}';
begin
  select user_id into v_admin_user
  from public.legal_profiles
  where email = v_admin_email and active and hierarchy_level = 'ADMIN';
  if v_admin_user is null then
    raise exception 'Perfil ADMIN % não encontrado ou inativo', v_admin_email;
  end if;

  select * into v_current
  from public.legal_expirations
  where id = v_target and deleted_at is null
  for update;
  if not found then
    raise exception 'Vencimento % não encontrado (ou já excluído)', v_target;
  end if;
  if v_current.status <> 'RENEWED' then
    raise exception 'Vencimento % não é RENEWED (status %)', v_target, v_current.status;
  end if;
  if exists (
    select 1 from public.legal_expirations s
    where s.previous_expiration_id = v_target and s.deleted_at is null
  ) then
    raise exception 'Vencimento % ainda tem sucessor vigente; exclua-o pelo app primeiro', v_target;
  end if;

  -- O registro e todos os anteriores da cadeia.
  loop
    v_ids := v_ids || v_current.id;
    exit when v_current.previous_expiration_id is null or array_length(v_ids, 1) >= 50;
    select * into v_current
    from public.legal_expirations
    where id = v_current.previous_expiration_id and deleted_at is null
    for update;
    exit when not found;
  end loop;

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_admin_user,
      'role', 'authenticated',
      'amr', json_build_array(json_build_object('method', 'oauth', 'timestamp', 0)),
      'app_metadata', json_build_object('provider', 'azure', 'providers', json_build_array('azure'))
    )::text,
    true
  );
  perform set_config('legal.renewal_context', 'on', true);

  update public.legal_expirations
  set deleted_at = now()
  where id = any (v_ids);

  perform set_config('legal.renewal_context', 'off', true);
  perform set_config('request.jwt.claims', '', true);

  insert into legal_cleanup_result
  select e.id, e.document_name, e.status::text, e.deleted_at
  from public.legal_expirations e
  where e.id = any (v_ids);
end
$$;

select jsonb_build_object(
  'excluidos', (select jsonb_agg(to_jsonb(r)) from legal_cleanup_result r),
  'auditoria', (
    select jsonb_agg(jsonb_build_object('acao', a.action, 'registro', a.entity_id, 'em', a.created_at))
    from public.legal_audit_logs a
    where a.entity_id in (select id from legal_cleanup_result)
      and a.action = 'EXPIRATION_DELETED')
) as result;
