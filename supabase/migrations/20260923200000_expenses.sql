-- =============================================================================
-- Fase 1a: despesas registradas em poucos segundos.
--
-- Visibilidade (opção "b"):
--   * Cada pessoa vê as próprias despesas.
--   * Administradores veem as despesas das outras pessoas, exceto as marcadas
--     como privadas. As privadas entram apenas nos totais que o administrador vê.
--   * Fornecedores pertencem a cada pessoa (lista própria). Assim, digitar o
--     nome de um fornecedor não revela se outra pessoa já comprou nele, e a
--     categoria padrão de um fornecedor é preferência individual.
--   * O nome de um fornecedor só aparece para quem é dono dele ou para quem
--     enxerga uma despesa (não privada) feita nele.
--   * Excluir a conta de uma pessoa apaga as despesas e o histórico dela (LGPD).
--
-- Dinheiro em centavos (bigint). Histórico preservado em expense_history.
-- =============================================================================

create type public.payment_method as enum ('credit_card', 'debit_card', 'pix', 'boleto', 'cash', 'transfer', 'other');
create type public.expense_kind as enum ('essential', 'lifestyle', 'other');

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind public.expense_kind not null default 'other',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id)
);

create unique index categories_org_name_idx on public.categories (org_id, lower(btrim(name)));

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  default_category_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, default_category_id) references public.categories (org_id, id)
);

create unique index suppliers_owner_name_idx on public.suppliers (org_id, owner_id, lower(btrim(name)));

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  supplier_id uuid not null,
  category_id uuid,
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  payment_method public.payment_method not null,
  purchase_date date not null,
  competence_month date not null check (competence_month = date_trunc('month', competence_month)::date),
  description text check (description is null or char_length(description) <= 280),
  is_private boolean not null default false,
  source text not null default 'manual' check (source in ('manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (org_id, id),
  -- Chaves compostas: fornecedor e categoria precisam ser da mesma organização.
  foreign key (org_id, supplier_id) references public.suppliers (org_id, id),
  foreign key (org_id, category_id) references public.categories (org_id, id)
);

create index expenses_org_month_idx on public.expenses (org_id, competence_month) where deleted_at is null;
create index expenses_org_owner_month_idx on public.expenses (org_id, owner_id, competence_month) where deleted_at is null;
create index expenses_org_supplier_idx on public.expenses (org_id, supplier_id);

-- Histórico de alterações e exclusões (somente inclusão).
create table public.expense_history (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  expense_id uuid not null,
  operation text not null check (operation in ('update', 'delete')),
  changed_by uuid,
  changed_at timestamptz not null default now(),
  previous jsonb not null,
  -- Some junto com a despesa quando a conta da pessoa é excluída.
  foreign key (org_id, expense_id) references public.expenses (org_id, id) on delete cascade
);

create index expense_history_expense_idx on public.expense_history (org_id, expense_id, changed_at desc);

create trigger categories_updated_at before update on public.categories
  for each row execute function private.set_updated_at();
create trigger suppliers_updated_at before update on public.suppliers
  for each row execute function private.set_updated_at();
create trigger expenses_updated_at before update on public.expenses
  for each row execute function private.set_updated_at();

-- Mesma regra da auditoria: imutável, exceto a cascata da exclusão da organização.
create function private.expense_history_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Só aceita remoção em cascata: da organização inteira ou da despesa
  -- (que por sua vez só é apagada fisicamente com a exclusão da conta).
  if tg_op = 'DELETE'
     and pg_trigger_depth() > 1
     and (
       not exists (select 1 from public.organizations o where o.id = old.org_id)
       or not exists (select 1 from public.expenses e where e.id = old.expense_id)
     ) then
    return old;
  end if;
  raise exception 'expense_history é somente de inclusão' using errcode = '42501';
end;
$$;

create trigger expense_history_no_update before update or delete on public.expense_history
  for each row execute function private.expense_history_is_append_only();
create trigger expense_history_no_truncate before truncate on public.expense_history
  for each statement execute function private.expense_history_is_append_only();

-- -----------------------------------------------------------------------------
-- Categorias padrão (novas organizações e as que já existem)
-- -----------------------------------------------------------------------------

create function private.seed_default_categories(p_org_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (org_id, name, kind)
  values
    (p_org_id, 'Moradia', 'essential'),
    (p_org_id, 'Contas e serviços', 'essential'),
    (p_org_id, 'Supermercado', 'essential'),
    (p_org_id, 'Transporte', 'essential'),
    (p_org_id, 'Saúde', 'essential'),
    (p_org_id, 'Educação', 'essential'),
    (p_org_id, 'Restaurantes', 'lifestyle'),
    (p_org_id, 'Compras', 'lifestyle'),
    (p_org_id, 'Lazer e viagem', 'lifestyle'),
    (p_org_id, 'Assinaturas', 'lifestyle'),
    (p_org_id, 'Outros', 'other')
  on conflict do nothing;
$$;

create function private.organization_seed_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_default_categories(new.id);
  return new;
end;
$$;

create trigger organizations_seed_categories after insert on public.organizations
  for each row execute function private.organization_seed_categories();

select private.seed_default_categories(o.id) from public.organizations o;

-- -----------------------------------------------------------------------------
-- Privilégios e RLS
-- -----------------------------------------------------------------------------

revoke all on public.categories, public.suppliers, public.expenses, public.expense_history from anon, authenticated;
grant select on public.categories, public.expenses to authenticated;
-- De fornecedores, só o necessário para exibir: nada de dono, datas ou categoria padrão.
grant select (id, org_id, name) on public.suppliers to authenticated;
-- expense_history fica sem acesso direto: é trilha de auditoria.

alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_history enable row level security;

create policy mfa_required on public.categories as restrictive for all to authenticated
  using ((select private.has_mfa())) with check ((select private.has_mfa()));
create policy mfa_required on public.suppliers as restrictive for all to authenticated
  using ((select private.has_mfa())) with check ((select private.has_mfa()));
create policy mfa_required on public.expenses as restrictive for all to authenticated
  using ((select private.has_mfa())) with check ((select private.has_mfa()));
create policy mfa_required on public.expense_history as restrictive for all to authenticated
  using ((select private.has_mfa())) with check ((select private.has_mfa()));

create policy categories_select on public.categories for select to authenticated
  using (org_id in (select private.user_org_ids()));

create policy expenses_select on public.expenses for select to authenticated
  using (
    deleted_at is null
    and org_id in (select private.user_org_ids())
    and (
      owner_id = (select auth.uid())
      or (not is_private and org_id in (select private.admin_org_ids()))
    )
  );

create policy suppliers_select on public.suppliers for select to authenticated
  using (
    org_id in (select private.user_org_ids())
    and (
      owner_id = (select auth.uid())
      -- A subconsulta passa pelo RLS de expenses: só conta despesa visível.
      or exists (select 1 from public.expenses e where e.org_id = suppliers.org_id and e.supplier_id = suppliers.id)
    )
  );

-- -----------------------------------------------------------------------------
-- Operações
-- -----------------------------------------------------------------------------

create function private.require_membership(p_org_id uuid)
returns public.org_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.org_role := private.org_role(p_org_id);
begin
  if v_role is null then
    raise exception 'sem permissão' using errcode = 'FA403';
  end if;
  return v_role;
end;
$$;

create function private.upsert_supplier(p_org_id uuid, p_name text, p_owner_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_id uuid;
begin
  if char_length(v_name) = 0 or char_length(v_name) > 120 then
    raise exception 'informe o fornecedor (até 120 caracteres)' using errcode = 'FA422';
  end if;

  insert into public.suppliers (org_id, owner_id, name)
  values (p_org_id, p_owner_id, v_name)
  on conflict (org_id, owner_id, lower(btrim(name))) do nothing
  returning id into v_id;

  if v_id is null then
    select s.id into v_id from public.suppliers s
    where s.org_id = p_org_id and s.owner_id = p_owner_id and lower(btrim(s.name)) = lower(v_name);
  end if;
  return v_id;
end;
$$;

create function private.resolve_competence(p_purchase_date date, p_competence_month date)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', coalesce(p_competence_month, p_purchase_date))::date;
begin
  -- Competência pode diferir da compra (ex.: conta do mês anterior), mas no máximo 24 meses.
  if v_month < (date_trunc('month', p_purchase_date) - interval '24 months')::date
     or v_month > (date_trunc('month', p_purchase_date) + interval '24 months')::date then
    raise exception 'mês de competência muito distante da data da compra' using errcode = 'FA422';
  end if;
  return v_month;
end;
$$;

create function public.create_expense(
  p_org_id uuid,
  p_supplier_name text,
  p_amount_cents bigint,
  p_payment_method public.payment_method,
  p_purchase_date date,
  p_category_id uuid default null,
  p_competence_month date default null,
  p_description text default null,
  p_is_private boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_mfa_user();
  v_supplier_id uuid;
  v_category_id uuid := p_category_id;
  v_id uuid;
begin
  perform private.require_membership(p_org_id);

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'informe um valor maior que zero' using errcode = 'FA422';
  end if;
  if p_purchase_date is null or p_purchase_date > current_date + 1 or p_purchase_date < date '2000-01-01' then
    raise exception 'data da compra inválida' using errcode = 'FA422';
  end if;
  if v_category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = v_category_id and c.org_id = p_org_id and c.archived_at is null
  ) then
    raise exception 'categoria inválida' using errcode = 'FA422';
  end if;

  v_supplier_id := private.upsert_supplier(p_org_id, p_supplier_name, v_uid);

  -- Sem categoria informada, usa a última que a própria pessoa escolheu para o fornecedor.
  if v_category_id is null then
    select s.default_category_id into v_category_id
    from public.suppliers s
    join public.categories c on c.id = s.default_category_id and c.archived_at is null
    where s.id = v_supplier_id;
  else
    update public.suppliers set default_category_id = v_category_id
    where id = v_supplier_id and default_category_id is distinct from v_category_id;
  end if;

  insert into public.expenses (
    org_id, owner_id, supplier_id, category_id, amount_cents, payment_method,
    purchase_date, competence_month, description, is_private
  )
  values (
    p_org_id, v_uid, v_supplier_id, v_category_id, p_amount_cents, p_payment_method,
    p_purchase_date,
    private.resolve_competence(p_purchase_date, p_competence_month),
    nullif(btrim(coalesce(p_description, '')), ''),
    coalesce(p_is_private, false)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create function public.update_expense(
  p_expense_id uuid,
  p_supplier_name text,
  p_amount_cents bigint,
  p_payment_method public.payment_method,
  p_purchase_date date,
  p_category_id uuid,
  p_competence_month date,
  p_description text,
  p_is_private boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_mfa_user();
  v_old public.expenses%rowtype;
  v_supplier_id uuid;
begin
  select * into v_old from public.expenses e
  where e.id = p_expense_id and e.owner_id = v_uid and e.deleted_at is null
  for update;

  -- Só quem registrou edita. Mesma resposta para inexistente e alheia.
  if v_old.id is null or private.org_role(v_old.org_id) is null then
    raise exception 'despesa não encontrada' using errcode = 'FA404';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'informe um valor maior que zero' using errcode = 'FA422';
  end if;
  if p_purchase_date is null or p_purchase_date > current_date + 1 or p_purchase_date < date '2000-01-01' then
    raise exception 'data da compra inválida' using errcode = 'FA422';
  end if;
  if p_category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = p_category_id and c.org_id = v_old.org_id and c.archived_at is null
  ) then
    raise exception 'categoria inválida' using errcode = 'FA422';
  end if;

  v_supplier_id := private.upsert_supplier(v_old.org_id, p_supplier_name, v_uid);

  insert into public.expense_history (org_id, expense_id, operation, changed_by, previous)
  values (v_old.org_id, v_old.id, 'update', v_uid, to_jsonb(v_old));

  update public.expenses set
    supplier_id = v_supplier_id,
    category_id = p_category_id,
    amount_cents = p_amount_cents,
    payment_method = p_payment_method,
    purchase_date = p_purchase_date,
    competence_month = private.resolve_competence(p_purchase_date, p_competence_month),
    description = nullif(btrim(coalesce(p_description, '')), ''),
    is_private = coalesce(p_is_private, false)
  where id = v_old.id;
end;
$$;

create function public.delete_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_mfa_user();
  v_old public.expenses%rowtype;
begin
  select * into v_old from public.expenses e
  where e.id = p_expense_id and e.owner_id = v_uid and e.deleted_at is null
  for update;

  if v_old.id is null or private.org_role(v_old.org_id) is null then
    raise exception 'despesa não encontrada' using errcode = 'FA404';
  end if;

  insert into public.expense_history (org_id, expense_id, operation, changed_by, previous)
  values (v_old.org_id, v_old.id, 'delete', v_uid, to_jsonb(v_old));

  update public.expenses set deleted_at = now() where id = v_old.id;
end;
$$;

-- Totais do mês de competência respeitando a visibilidade:
--   visible_cents: soma do que a pessoa pode ver linha a linha;
--   hidden_private_cents: despesas privadas de outras pessoas (só para administradores);
--   total_cents: visible + hidden.
create function public.expense_month_summary(p_org_id uuid, p_month date)
returns table (total_cents bigint, visible_cents bigint, hidden_private_cents bigint, expense_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_mfa_user();
  v_role public.org_role := private.require_membership(p_org_id);
  v_month date := date_trunc('month', p_month)::date;
begin
  return query
  with scoped as (
    select e.amount_cents,
           (e.owner_id = v_uid or (v_role in ('owner', 'admin') and not e.is_private)) as visible
    from public.expenses e
    where e.org_id = p_org_id
      and e.competence_month = v_month
      and e.deleted_at is null
      and (e.owner_id = v_uid or v_role in ('owner', 'admin'))
  )
  select
    coalesce(sum(amount_cents), 0)::bigint,
    coalesce(sum(amount_cents) filter (where visible), 0)::bigint,
    coalesce(sum(amount_cents) filter (where not visible), 0)::bigint,
    (count(*) filter (where visible))::integer
  from scoped;
end;
$$;

revoke all on function
  public.create_expense(uuid, text, bigint, public.payment_method, date, uuid, date, text, boolean),
  public.update_expense(uuid, text, bigint, public.payment_method, date, uuid, date, text, boolean),
  public.delete_expense(uuid),
  public.expense_month_summary(uuid, date)
from public, anon;

grant execute on function
  public.create_expense(uuid, text, bigint, public.payment_method, date, uuid, date, text, boolean),
  public.update_expense(uuid, text, bigint, public.payment_method, date, uuid, date, text, boolean),
  public.delete_expense(uuid),
  public.expense_month_summary(uuid, date)
to authenticated;

-- Funções internas: nada executável por clientes além das usadas nas políticas.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.has_mfa(),
  private.user_org_ids(),
  private.admin_org_ids(),
  private.co_member_ids(),
  private.org_role(uuid),
  private.can_access_owned(uuid, uuid)
to authenticated;
