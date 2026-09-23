-- Reprodução mínima do ambiente Supabase para testar migrações e RLS sem Docker.
-- Replica: papéis, schema auth, auth.uid(), auth.jwt() e os privilégios padrão
-- que o Supabase concede em "public" (o que torna o RLS a única barreira).

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

grant execute on function auth.jwt(), auth.uid() to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
