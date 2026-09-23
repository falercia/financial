-- =============================================================================
-- Identidade, organizações, membros, convites e auditoria.
--
-- Modelo de segurança:
--   1. Toda tabela tem RLS habilitado. Nenhum acesso para o papel "anon".
--   2. Uma política RESTRITIVA em cada tabela exige sessão com MFA (aal2).
--   3. Políticas permissivas limitam o acesso às organizações do usuário.
--   4. Escritas sensíveis passam por funções SECURITY DEFINER com validação
--      explícita, nunca por INSERT/UPDATE direto do cliente.
--   5. A auditoria é somente de inclusão: um gatilho bloqueia UPDATE e DELETE
--      (exceto a remoção em cascata quando a organização inteira é excluída).
--   6. Erros de regra de negócio usam SQLSTATE próprios (classe "FA"), os únicos
--      cujas mensagens a aplicação mostra ao usuário.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------

create type public.org_role as enum ('owner', 'admin', 'member');

-- -----------------------------------------------------------------------------
-- Funções utilitárias
-- -----------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Sessão autenticada com segundo fator verificado.
create function private.has_mfa()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
     and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  -- Plano e limite de pessoas: alterados apenas pelo backend (cobrança).
  plan text not null default 'personal' check (plan in ('personal', 'family', 'team')),
  seat_limit integer not null default 5 check (seat_limit between 1 and 1000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (
    email = lower(email)
    and char_length(email) <= 254
    and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  role public.org_role not null check (role <> 'owner'),
  -- Guardamos apenas o hash SHA-256 do token. O token em si só existe no link.
  token_hash bytea not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (accepted_at is null or revoked_at is null)
);

create unique index invitations_one_pending_per_email
  on public.invitations (org_id, email)
  where accepted_at is null and revoked_at is null;

create index invitations_org_id_idx on public.invitations (org_id, created_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations (id) on delete cascade,
  -- Sem FK: o registro sobrevive à exclusão da conta de quem agiu.
  actor_id uuid,
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_org_created_idx on public.audit_log (org_id, created_at desc);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger organizations_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger memberships_updated_at before update on public.memberships
  for each row execute function private.set_updated_at();

-- Auditoria imutável, inclusive para a service role.
create function private.audit_log_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Única exceção: a remoção em cascata disparada pela exclusão da própria
  -- organização (a linha da organização já não existe nesse momento).
  if tg_op = 'DELETE'
     and pg_trigger_depth() > 1
     and not exists (select 1 from public.organizations o where o.id = old.org_id) then
    return old;
  end if;
  raise exception 'audit_log é somente de inclusão' using errcode = '42501';
end;
$$;

create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function private.audit_log_is_append_only();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function private.audit_log_is_append_only();

-- -----------------------------------------------------------------------------
-- Funções de acesso usadas pelas políticas (SECURITY DEFINER evita recursão
-- de RLS em memberships; retornam conjuntos para o Postgres avaliar uma vez).
-- -----------------------------------------------------------------------------

create function private.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m where m.user_id = auth.uid();
$$;

create function private.admin_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id
  from public.memberships m
  where m.user_id = auth.uid() and m.role in ('owner', 'admin');
$$;

create function private.co_member_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct other.user_id
  from public.memberships mine
  join public.memberships other on other.org_id = mine.org_id
  where mine.user_id = auth.uid();
$$;

create function private.org_role(p_org_id uuid)
returns public.org_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.memberships m
  where m.org_id = p_org_id and m.user_id = auth.uid();
$$;

-- Regra de visibilidade dos dados financeiros (usada a partir da Fase 1):
-- administradores veem tudo da organização; membros veem apenas o que é seu.
create function private.can_access_owned(p_org_id uuid, p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
      and (m.role in ('owner', 'admin') or p_owner_id = auth.uid())
  );
$$;


-- -----------------------------------------------------------------------------
-- Privilégios: nada para anon; apenas o necessário para authenticated.
-- -----------------------------------------------------------------------------

revoke all on public.profiles, public.organizations, public.memberships,
  public.invitations, public.audit_log from anon, authenticated;

grant select on public.profiles, public.organizations, public.memberships,
  public.invitations, public.audit_log to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant update (name) on public.organizations to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log enable row level security;

-- MFA obrigatório em todas as tabelas (política restritiva: combina com AND).
create policy mfa_required on public.profiles as restrictive for all to authenticated
  using ((select private.has_mfa())) with check ((select private.has_mfa()));
create policy mfa_required on public.organizations as restrictive for all to authenticated
  using ((select private.has_mfa())) with check ((select private.has_mfa()));
create policy mfa_required on public.memberships as restrictive for all to authenticated
  using ((select private.has_mfa())) with check ((select private.has_mfa()));
create policy mfa_required on public.invitations as restrictive for all to authenticated
  using ((select private.has_mfa())) with check ((select private.has_mfa()));
create policy mfa_required on public.audit_log as restrictive for all to authenticated
  using ((select private.has_mfa())) with check ((select private.has_mfa()));

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or id in (select private.co_member_ids()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy organizations_select on public.organizations for select to authenticated
  using (id in (select private.user_org_ids()));
create policy organizations_update_admin on public.organizations for update to authenticated
  using (id in (select private.admin_org_ids()))
  with check (id in (select private.admin_org_ids()));

create policy memberships_select on public.memberships for select to authenticated
  using (org_id in (select private.user_org_ids()));

create policy invitations_select_admin on public.invitations for select to authenticated
  using (org_id in (select private.admin_org_ids()));

create policy audit_log_select_admin on public.audit_log for select to authenticated
  using (org_id in (select private.admin_org_ids()));

-- -----------------------------------------------------------------------------
-- Perfil criado automaticamente no cadastro
-- -----------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120)
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Operações (RPC). Todas exigem usuário autenticado com MFA.
-- -----------------------------------------------------------------------------

create function private.require_mfa_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = 'FA401';
  end if;
  if not private.has_mfa() then
    raise exception 'verificação em duas etapas obrigatória' using errcode = 'FA401';
  end if;
  return v_uid;
end;
$$;

create function private.audit(
  p_org_id uuid,
  p_actor_id uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, metadata)
  values (p_org_id, p_actor_id, p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
$$;

create function private.seats_in_use(p_org_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.memberships m where m.org_id = p_org_id)::integer
    + (select count(*) from public.invitations i
       where i.org_id = p_org_id
         and i.accepted_at is null
         and i.revoked_at is null
         and i.expires_at > now())::integer;
$$;


create function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_mfa_user();
  v_org_id uuid;
  v_owned integer;
begin
  select count(*) into v_owned
  from public.memberships m
  where m.user_id = v_uid and m.role = 'owner';

  if v_owned >= 10 then
    raise exception 'limite de organizações atingido' using errcode = 'FA422';
  end if;

  insert into public.organizations (name, created_by)
  values (btrim(p_name), v_uid)
  returning id into v_org_id;

  insert into public.memberships (org_id, user_id, role)
  values (v_org_id, v_uid, 'owner');

  perform private.audit(v_org_id, v_uid, 'organization.created', 'organization', v_org_id::text,
    jsonb_build_object('name', btrim(p_name)));

  return v_org_id;
end;
$$;

-- Serializa alterações de membros e convites de uma organização. Todas as
-- operações abaixo bloqueiam a linha da organização ANTES de ler papéis ou
-- contar lugares, evitando corridas (ex.: dois proprietários saindo juntos).
create function private.lock_organization(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.organizations o where o.id = p_org_id for update;
end;
$$;

-- Papel mínimo que alguém precisa ter para oferecer o papel informado.
create function private.can_grant(p_granter_role public.org_role, p_role public.org_role)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'member' then p_granter_role in ('owner', 'admin')
    when 'admin' then p_granter_role = 'owner'
    else false
  end;
$$;

create function public.create_invitation(p_org_id uuid, p_email text, p_role public.org_role)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_mfa_user();
  v_email text := lower(btrim(p_email));
  v_role public.org_role;
  v_token text;
  v_invitation_id uuid;
  v_seat_limit integer;
begin
  perform private.lock_organization(p_org_id);
  v_role := private.org_role(p_org_id);

  if v_role is null or v_role not in ('owner', 'admin') then
    raise exception 'sem permissão' using errcode = 'FA403';
  end if;
  if p_role = 'owner' then
    raise exception 'convite não pode conceder o papel de proprietário' using errcode = 'FA422';
  end if;
  if not private.can_grant(v_role, p_role) then
    raise exception 'apenas o proprietário convida administradores' using errcode = 'FA403';
  end if;
  if exists (
    select 1 from public.memberships m
    join auth.users u on u.id = m.user_id
    where m.org_id = p_org_id and lower(u.email) = v_email
  ) then
    raise exception 'pessoa já faz parte da organização' using errcode = 'FA409';
  end if;
  -- Administrador não substitui um convite de administrador feito pelo proprietário.
  if exists (
    select 1 from public.invitations i
    where i.org_id = p_org_id and i.email = v_email
      and i.accepted_at is null and i.revoked_at is null
      and not private.can_grant(v_role, i.role)
  ) then
    raise exception 'já existe um convite do proprietário para este e-mail' using errcode = 'FA403';
  end if;

  -- Convite anterior para o mesmo e-mail é substituído.
  update public.invitations
  set revoked_at = now()
  where org_id = p_org_id and email = v_email
    and accepted_at is null and revoked_at is null;

  select o.seat_limit into v_seat_limit from public.organizations o where o.id = p_org_id;
  if private.seats_in_use(p_org_id) >= v_seat_limit then
    raise exception 'limite de pessoas do plano atingido' using errcode = 'FA422';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.invitations (org_id, email, role, token_hash, invited_by, expires_at)
  values (p_org_id, v_email, p_role, sha256(convert_to(v_token, 'UTF8')), v_uid, now() + interval '7 days')
  returning id into v_invitation_id;

  perform private.audit(p_org_id, v_uid, 'invitation.created', 'invitation', v_invitation_id::text,
    jsonb_build_object('email', v_email, 'role', p_role));

  return v_token;
end;
$$;

create function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_mfa_user();
  v_org_id uuid;
  v_inv_role public.org_role;
  v_role public.org_role;
begin
  select i.org_id into v_org_id from public.invitations i where i.id = p_invitation_id;
  if v_org_id is null then
    raise exception 'convite não encontrado' using errcode = 'FA404';
  end if;

  perform private.lock_organization(v_org_id);
  v_role := private.org_role(v_org_id);

  select i.role into v_inv_role
  from public.invitations i
  where i.id = p_invitation_id and i.accepted_at is null and i.revoked_at is null;

  if v_inv_role is null or v_role is null or not private.can_grant(v_role, v_inv_role) then
    raise exception 'convite não encontrado' using errcode = 'FA404';
  end if;

  update public.invitations set revoked_at = now() where id = p_invitation_id;

  perform private.audit(v_org_id, v_uid, 'invitation.revoked', 'invitation', p_invitation_id::text);
end;
$$;

create function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_mfa_user();
  v_hash bytea := sha256(convert_to(coalesce(p_token, ''), 'UTF8'));
  v_email text;
  v_org_id uuid;
  v_inv public.invitations%rowtype;
  v_inviter_role public.org_role;
  v_seat_limit integer;
  v_members integer;
begin
  -- E-mail vem da conta (confirmada), nunca apenas do token de sessão.
  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_uid and u.email_confirmed_at is not null;

  select i.org_id into v_org_id from public.invitations i where i.token_hash = v_hash;
  if v_org_id is not null then
    perform private.lock_organization(v_org_id);
  end if;

  select * into v_inv from public.invitations i where i.token_hash = v_hash for update;

  select m.role into v_inviter_role
  from public.memberships m
  where m.org_id = v_inv.org_id and m.user_id = v_inv.invited_by;

  -- Mesma mensagem para todos os casos, para não revelar convites existentes.
  -- O convite só vale se quem convidou ainda tem autoridade para conceder o papel.
  if v_inv.id is null
     or v_inv.accepted_at is not null
     or v_inv.revoked_at is not null
     or v_inv.expires_at <= now()
     or v_email is null
     or v_inv.email <> v_email
     or v_inviter_role is null
     or not private.can_grant(v_inviter_role, v_inv.role) then
    raise exception 'convite inválido ou expirado' using errcode = 'FA404';
  end if;

  if exists (select 1 from public.memberships m where m.org_id = v_inv.org_id and m.user_id = v_uid) then
    raise exception 'você já faz parte desta organização' using errcode = 'FA409';
  end if;

  select o.seat_limit into v_seat_limit from public.organizations o where o.id = v_inv.org_id;
  select count(*) into v_members from public.memberships m where m.org_id = v_inv.org_id;
  if v_members >= v_seat_limit then
    raise exception 'limite de pessoas do plano atingido' using errcode = 'FA422';
  end if;

  insert into public.memberships (org_id, user_id, role) values (v_inv.org_id, v_uid, v_inv.role);
  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;

  perform private.audit(v_inv.org_id, v_uid, 'membership.joined', 'membership', v_uid::text,
    jsonb_build_object('role', v_inv.role, 'invitation_id', v_inv.id));

  return v_inv.org_id;
end;
$$;

create function public.update_member_role(p_org_id uuid, p_user_id uuid, p_role public.org_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_mfa_user();
  v_caller_role public.org_role;
  v_target_role public.org_role;
begin
  perform private.lock_organization(p_org_id);
  v_caller_role := private.org_role(p_org_id);

  select m.role into v_target_role
  from public.memberships m
  where m.org_id = p_org_id and m.user_id = p_user_id;

  if v_caller_role is null or v_caller_role not in ('owner', 'admin') or v_target_role is null then
    raise exception 'sem permissão' using errcode = 'FA403';
  end if;
  -- Só o proprietário mexe em proprietários e administradores.
  if v_caller_role <> 'owner' and (v_target_role <> 'member' or p_role <> 'member') then
    raise exception 'apenas o proprietário altera administradores' using errcode = 'FA403';
  end if;
  if v_target_role = 'owner' and p_role <> 'owner' and (
    select count(*) from public.memberships m where m.org_id = p_org_id and m.role = 'owner'
  ) = 1 then
    raise exception 'a organização precisa de ao menos um proprietário' using errcode = 'FA422';
  end if;

  update public.memberships set role = p_role where org_id = p_org_id and user_id = p_user_id;

  perform private.audit(p_org_id, v_uid, 'membership.role_changed', 'membership', p_user_id::text,
    jsonb_build_object('from', v_target_role, 'to', p_role));
end;
$$;

create function public.remove_member(p_org_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_mfa_user();
  v_caller_role public.org_role;
  v_target_role public.org_role;
begin
  perform private.lock_organization(p_org_id);
  v_caller_role := private.org_role(p_org_id);

  select m.role into v_target_role
  from public.memberships m
  where m.org_id = p_org_id and m.user_id = p_user_id;

  if v_caller_role is null or v_target_role is null then
    raise exception 'sem permissão' using errcode = 'FA403';
  end if;
  -- Qualquer pessoa pode sair; remover outra pessoa exige ser admin,
  -- e remover admin ou proprietário exige ser proprietário.
  if p_user_id <> v_uid and (
    v_caller_role = 'member'
    or (v_caller_role = 'admin' and v_target_role <> 'member')
  ) then
    raise exception 'sem permissão' using errcode = 'FA403';
  end if;
  if v_target_role = 'owner' and (
    select count(*) from public.memberships m where m.org_id = p_org_id and m.role = 'owner'
  ) = 1 then
    raise exception 'a organização precisa de ao menos um proprietário' using errcode = 'FA422';
  end if;

  delete from public.memberships where org_id = p_org_id and user_id = p_user_id;

  perform private.audit(p_org_id, v_uid,
    case when p_user_id = v_uid then 'membership.left' else 'membership.removed' end,
    'membership', p_user_id::text, jsonb_build_object('role', v_target_role));
end;
$$;

-- Renomear a organização (permitido a administradores via UPDATE) fica auditado.
create function private.audit_organization_rename()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    perform private.audit(new.id, auth.uid(), 'organization.renamed', 'organization', new.id::text,
      jsonb_build_object('from', old.name, 'to', new.name));
  end if;
  return new;
end;
$$;

create trigger organizations_audit_rename after update of name on public.organizations
  for each row execute function private.audit_organization_rename();

-- Nenhuma função interna é executável por papéis de cliente, exceto as das políticas.
-- O Postgres concede EXECUTE a PUBLIC por padrão: toda migração que criar função
-- em private deve repetir este bloco. O teste "apenas as funções das políticas"
-- falha se alguma ficar exposta.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.has_mfa(),
  private.user_org_ids(),
  private.admin_org_ids(),
  private.co_member_ids(),
  private.org_role(uuid),
  private.can_access_owned(uuid, uuid)
to authenticated;

revoke all on function
  public.create_organization(text),
  public.create_invitation(uuid, text, public.org_role),
  public.revoke_invitation(uuid),
  public.accept_invitation(text),
  public.update_member_role(uuid, uuid, public.org_role),
  public.remove_member(uuid, uuid)
from public, anon;

grant execute on function
  public.create_organization(text),
  public.create_invitation(uuid, text, public.org_role),
  public.revoke_invitation(uuid),
  public.accept_invitation(text),
  public.update_member_role(uuid, uuid, public.org_role),
  public.remove_member(uuid, uuid)
to authenticated;
