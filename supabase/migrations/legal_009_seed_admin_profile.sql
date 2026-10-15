-- legal_009 — Perfil ADMIN inicial (RF-02).
-- Idempotente: cria ou reativa o perfil somente se o usuário Auth existir.
-- Após o provisionamento, toda autorização consulta legal_profiles.
-- Rollback: supabase/rollback/legal_rollback_all.sql

insert into public.legal_profiles (user_id, name, email, hierarchy_level, is_admin, active)
select
  u.id,
  coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), 'Desenvolvimento'),
  lower(btrim(u.email)),
  'ADMIN',
  true,
  true
from auth.users u
where lower(btrim(u.email)) = 'desenvolvimento@escritoriologica.com.br'
on conflict (user_id) do update
set hierarchy_level = 'ADMIN',
    is_admin = true,
    active = true,
    manager_id = null;
