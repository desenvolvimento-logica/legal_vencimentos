-- legal_018 — Administração de perfis (SRS RF-02/RF-12, mockup 09).
-- Toda alteração de perfil passa por funções SECURITY DEFINER que exigem
-- ADMIN, validam a hierarquia (trigger de legal_006) e gravam auditoria.
-- Perfis só são criados para usuários já existentes em auth.users com
-- identidade Microsoft (decisão de 15/10/2026: o login é só Microsoft).
-- Idempotente. Rollback: drop das três funções abaixo.

-- Contas Microsoft ainda sem perfil neste sistema, para o admin escolher.
create or replace function public.legal_admin_list_profile_candidates(search text)
returns table (
  user_id uuid,
  email text,
  name text,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.legal_is_admin() then
    raise exception 'ACCESS DENIED' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    u.id,
    lower(btrim(u.email)),
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
      split_part(u.email, '@', 1)
    ),
    (
      select max(i.last_sign_in_at)
      from auth.identities i
      where i.user_id = u.id and i.provider = 'azure'
    )
  from auth.users u
  where u.email is not null
    and exists (
      select 1 from auth.identities i
      where i.user_id = u.id and i.provider = 'azure'
    )
    and not exists (
      select 1 from public.legal_profiles p where p.user_id = u.id
    )
    and (
      coalesce(btrim(search), '') = ''
      or u.email ilike '%' || btrim(search) || '%'
      or (u.raw_user_meta_data ->> 'full_name') ilike '%' || btrim(search) || '%'
      or (u.raw_user_meta_data ->> 'name') ilike '%' || btrim(search) || '%'
    )
  order by 2
  limit 20;
end;
$$;

create or replace function public.legal_admin_create_profile(
  target_user_id uuid,
  profile_name text,
  profile_job_title text,
  profile_level public.legal_hierarchy_level,
  profile_manager_id uuid
)
returns public.legal_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.legal_current_profile_id();
  v_email text;
  v_profile public.legal_profiles;
begin
  if not public.legal_is_admin() then
    raise exception 'ACCESS DENIED' using errcode = 'insufficient_privilege';
  end if;

  select lower(btrim(u.email)) into v_email
  from auth.users u
  where u.id = target_user_id
    and exists (
      select 1 from auth.identities i
      where i.user_id = u.id and i.provider = 'azure'
    );
  if v_email is null then
    raise exception 'Conta Microsoft não encontrada' using errcode = 'no_data_found';
  end if;

  if exists (select 1 from public.legal_profiles where user_id = target_user_id) then
    raise exception 'Este usuário já possui perfil no sistema' using errcode = 'check_violation';
  end if;

  insert into public.legal_profiles (
    user_id, name, email, job_title, hierarchy_level, manager_id, is_admin, active
  ) values (
    target_user_id,
    btrim(profile_name),
    v_email,
    nullif(btrim(profile_job_title), ''),
    profile_level,
    profile_manager_id,
    profile_level = 'ADMIN',
    true
  )
  returning * into v_profile;

  insert into public.legal_audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  values (v_admin, 'PROFILE_CREATED', 'legal_profiles', v_profile.id, null, to_jsonb(v_profile));

  return v_profile;
end;
$$;

create or replace function public.legal_admin_update_profile(
  target_profile_id uuid,
  profile_name text,
  profile_job_title text,
  profile_level public.legal_hierarchy_level,
  profile_manager_id uuid,
  profile_active boolean
)
returns public.legal_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.legal_current_profile_id();
  v_old public.legal_profiles;
  v_new public.legal_profiles;
  v_action text;
begin
  if not public.legal_is_admin() then
    raise exception 'ACCESS DENIED' using errcode = 'insufficient_privilege';
  end if;

  select * into v_old from public.legal_profiles where id = target_profile_id for update;
  if not found then
    raise exception 'Perfil não encontrado' using errcode = 'no_data_found';
  end if;

  -- Evita que o administrador perca o próprio acesso por engano.
  if v_old.id = v_admin and (not profile_active or profile_level <> 'ADMIN') then
    raise exception 'Você não pode desativar nem rebaixar o próprio perfil de administrador'
      using errcode = 'check_violation';
  end if;

  update public.legal_profiles
  set name = btrim(profile_name),
      job_title = nullif(btrim(profile_job_title), ''),
      hierarchy_level = profile_level,
      manager_id = profile_manager_id,
      is_admin = profile_level = 'ADMIN',
      active = profile_active
  where id = target_profile_id
  returning * into v_new;

  v_action := case
    when v_new.active is distinct from v_old.active then
      case when v_new.active then 'PROFILE_ACTIVATED' else 'PROFILE_DEACTIVATED' end
    when v_new.hierarchy_level is distinct from v_old.hierarchy_level then 'PROFILE_LEVEL_CHANGED'
    when v_new.manager_id is distinct from v_old.manager_id then 'PROFILE_MANAGER_CHANGED'
    else 'PROFILE_UPDATED'
  end;

  insert into public.legal_audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  values (v_admin, v_action, 'legal_profiles', v_new.id, to_jsonb(v_old), to_jsonb(v_new));

  return v_new;
end;
$$;

revoke all on function
  public.legal_admin_list_profile_candidates(text),
  public.legal_admin_create_profile(uuid, text, text, public.legal_hierarchy_level, uuid),
  public.legal_admin_update_profile(uuid, text, text, public.legal_hierarchy_level, uuid, boolean)
from public, anon, authenticated;

grant execute on function
  public.legal_admin_list_profile_candidates(text),
  public.legal_admin_create_profile(uuid, text, text, public.legal_hierarchy_level, uuid),
  public.legal_admin_update_profile(uuid, text, text, public.legal_hierarchy_level, uuid, boolean)
to authenticated;
