-- Stub mínimo do ambiente Supabase para testes locais (PGlite).
-- Reproduz somente o que as migrations legal_ usam: papéis, privilégios padrão
-- do schema public, auth.users e auth.uid(). Nunca executar em produção.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

grant usage on schema public to anon, authenticated, service_role;

-- Como no Supabase: objetos novos em public são concedidos a todos os papéis da API.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb,
  email_confirmed_at timestamptz
);

-- Mesma semântica de auth.uid() do Supabase: lê o "sub" das claims do JWT.
create function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;

-- Mesma semântica de auth.jwt() do Supabase: claims completas da requisição.
create function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb;
$$;

grant execute on function auth.jwt() to anon, authenticated, service_role;
