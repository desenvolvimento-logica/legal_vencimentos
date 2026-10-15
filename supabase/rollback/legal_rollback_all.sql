-- ROLLBACK MANUAL — remove TODOS os objetos do sistema (prefixo legal_).
-- DESTRUTIVO para os dados deste sistema: apaga perfis, vencimentos, auditoria
-- e caches. Não toca em objetos de outros sistemas nem em auth.users.
-- Usar somente com decisão explícita do responsável, nunca na operação normal.

begin;

drop table if exists public.legal_audit_logs;
drop table if exists public.legal_expirations;
drop table if exists public.legal_acessorias_requests;
drop table if exists public.legal_sync_logs;
drop table if exists public.legal_settings;
drop table if exists public.legal_acessorias_users;
drop table if exists public.legal_clients;
drop table if exists public.legal_profiles;

drop function if exists public.legal_complete_renewal(uuid, jsonb);
drop function if exists public.legal_expirations_audit();
drop function if exists public.legal_expirations_before_write();
drop function if exists public.legal_profiles_validate_hierarchy();
drop function if exists public.legal_can_access_client(uuid);
drop function if exists public.legal_scope_emails();
drop function if exists public.legal_get_user_scope();
drop function if exists public.legal_has_global_scope();
drop function if exists public.legal_is_admin();
drop function if exists public.legal_current_profile_id();
drop function if exists public.legal_current_profile();
drop function if exists public.legal_set_updated_at();

drop type if exists public.legal_sync_status;
drop type if exists public.legal_expiration_status;
drop type if exists public.legal_expiration_type;
drop type if exists public.legal_hierarchy_level;

commit;
