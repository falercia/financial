import { beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase, type TestUser } from "./harness";

/**
 * Org A: ana (owner), bruno (admin), carla (member)
 * Org B: diego (owner)
 */
let t: TestDatabase;
let ana: TestUser, bruno: TestUser, carla: TestUser, diego: TestUser, dan: TestUser;
let orgA: string, orgB: string;

const MONTH = "2026-09-01";

async function rpc<T = Record<string, unknown>>(user: TestUser, sql: string, params: unknown[] = []) {
  return t.as(user, async (tx) => (await tx.query<T>(sql, params)).rows, { commit: true });
}

async function read<T = Record<string, unknown>>(user: TestUser, sql: string, params: unknown[] = []) {
  return t.as(user, async (tx) => (await tx.query<T>(sql, params)).rows);
}

async function addExpense(
  user: TestUser,
  org: string,
  supplier: string,
  cents: number,
  options: { private?: boolean; category?: string | null; date?: string } = {},
) {
  const rows = await rpc<{ id: string }>(
    user,
    `select public.create_expense($1, $2, $3, 'pix', $4::date, $5, null, null, $6) as id`,
    [org, supplier, cents, options.date ?? "2026-09-10", options.category ?? null, options.private ?? false],
  );
  return rows[0].id;
}

async function summary(user: TestUser, org: string) {
  const [row] = await read<{ total_cents: string; visible_cents: string; hidden_private_cents: string; expense_count: number }>(
    user,
    "select * from public.expense_month_summary($1, $2::date)",
    [org, MONTH],
  );
  return {
    total: Number(row.total_cents),
    visible: Number(row.visible_cents),
    hidden: Number(row.hidden_private_cents),
    count: row.expense_count,
  };
}

async function invite(by: TestUser, org: string, who: TestUser, role: "admin" | "member") {
  const [{ token }] = await rpc<{ token: string }>(by, "select public.create_invitation($1, $2, $3) as token", [
    org,
    who.email,
    role,
  ]);
  await rpc(who, "select public.accept_invitation($1)", [token]);
}

beforeAll(async () => {
  t = await createTestDatabase();
  ana = await t.createUser("ana@exemplo.com", "Ana");
  bruno = await t.createUser("bruno@exemplo.com", "Bruno");
  carla = await t.createUser("carla@exemplo.com", "Carla");
  diego = await t.createUser("diego@exemplo.com", "Diego");
  dan = await t.createUser("dan@exemplo.com", "Dan");
  orgA = (await rpc<{ id: string }>(ana, "select public.create_organization('Família') as id"))[0].id;
  orgB = (await rpc<{ id: string }>(diego, "select public.create_organization('Outra casa') as id"))[0].id;
  await invite(ana, orgA, bruno, "admin");
  await invite(ana, orgA, carla, "member");
  await invite(ana, orgA, dan, "member");

  await addExpense(ana, orgA, "Condor Supermercados", 18790);
  await addExpense(carla, orgA, "iFood", 6840);
  await addExpense(carla, orgA, "Presente surpresa", 25000, { private: true });
  await addExpense(diego, orgB, "Posto Ipiranga", 21000);
});

describe("categorias padrão", () => {
  it("toda organização nova nasce com categorias", async () => {
    const rows = await read<{ n: number }>(ana, "select count(*)::int as n from public.categories where org_id = $1", [orgA]);
    expect(rows[0].n).toBeGreaterThanOrEqual(10);
  });

  it("não é possível usar categoria de outra organização", async () => {
    const [{ id }] = await read<{ id: string }>(diego, "select id from public.categories where org_id = $1 limit 1", [orgB]);
    await expect(addExpense(ana, orgA, "Loja", 1000, { category: id })).rejects.toThrow(/categoria inválida/);
  });
});

describe("visibilidade de despesas (opção b)", () => {
  const suppliersSeenBy = async (user: TestUser) =>
    (
      await read<{ name: string }>(
        user,
        "select s.name from public.expenses e join public.suppliers s on s.id = e.supplier_id where e.org_id = $1 order by 1",
        [orgA],
      )
    )
      .map((r) => r.name)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

  it("membro vê apenas as próprias despesas, inclusive as privadas", async () => {
    expect(await suppliersSeenBy(carla)).toEqual(["iFood", "Presente surpresa"]);
  });

  it("administrador vê as despesas dos outros, menos as privadas", async () => {
    expect(await suppliersSeenBy(bruno)).toEqual(["Condor Supermercados", "iFood"]);
    expect(await suppliersSeenBy(ana)).toEqual(["Condor Supermercados", "iFood"]);
  });

  it("nome do fornecedor de compra privada não aparece para o administrador", async () => {
    const names = (await read<{ name: string }>(bruno, "select name from public.suppliers where org_id = $1", [orgA])).map(
      (r) => r.name,
    );
    expect(names).not.toContain("Presente surpresa");
  });

  it("administrador vê o valor privado apenas no total", async () => {
    expect(await summary(ana, orgA)).toEqual({ total: 18790 + 6840 + 25000, visible: 18790 + 6840, hidden: 25000, count: 2 });
  });

  it("membro vê só o total das próprias despesas", async () => {
    expect(await summary(carla, orgA)).toEqual({ total: 6840 + 25000, visible: 6840 + 25000, hidden: 0, count: 2 });
  });

  it("outra organização não vê nada nem consegue pedir o total", async () => {
    const rows = await read(diego, "select * from public.expenses where org_id = $1", [orgA]);
    expect(rows).toEqual([]);
    await expect(read(diego, "select * from public.expense_month_summary($1, $2::date)", [orgA, MONTH])).rejects.toThrow(
      /sem permissão/,
    );
  });

  it("sem MFA, nenhuma despesa é lida", async () => {
    const rows = await t.as(ana, async (tx) => (await tx.query("select * from public.expenses")).rows, { aal: "aal1" });
    expect(rows).toEqual([]);
  });
});

describe("escrita de despesas", () => {
  it("não é possível lançar em organização da qual não se participa", async () => {
    await expect(addExpense(diego, orgA, "Invasor", 100)).rejects.toThrow(/sem permissão/);
  });

  it("despesa sempre pertence a quem lançou", async () => {
    const id = await addExpense(bruno, orgA, "Farmácia", 4590);
    const rows = await t.db.query<{ owner_id: string }>("select owner_id from public.expenses where id = $1", [id]);
    expect(rows.rows[0].owner_id).toBe(bruno.id);
  });

  it("escrita direta na tabela é bloqueada", async () => {
    const attempt = t.as(ana, (tx) => tx.query("update public.expenses set amount_cents = 1 where org_id = $1", [orgA]));
    await expect(attempt).rejects.toThrow(/permission denied/);
  });

  it("valida valor e fornecedor", async () => {
    await expect(addExpense(ana, orgA, "Loja", 0)).rejects.toThrow(/maior que zero/);
    await expect(addExpense(ana, orgA, "   ", 100)).rejects.toThrow(/fornecedor/);
  });

  it("fornecedor com grafias diferentes vira um só", async () => {
    await addExpense(ana, orgA, "  condor   supermercados ", 1000);
    const rows = await t.db.query<{ n: number }>(
      "select count(*)::int as n from public.suppliers where org_id = $1 and lower(name) like 'condor%'",
      [orgA],
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it("fornecedor lembra a última categoria usada", async () => {
    const [{ id: category }] = await read<{ id: string }>(
      ana,
      "select id from public.categories where org_id = $1 and name = 'Supermercado'",
      [orgA],
    );
    await addExpense(ana, orgA, "Muffato", 5000, { category });
    const second = await addExpense(ana, orgA, "Muffato", 7000);
    const rows = await t.db.query<{ category_id: string }>("select category_id from public.expenses where id = $1", [second]);
    expect(rows.rows[0].category_id).toBe(category);
  });

  it("competência é o mês da compra", async () => {
    const id = await addExpense(ana, orgA, "Padaria", 1200, { date: "2026-08-31" });
    const rows = await t.db.query<{ m: string }>("select competence_month::text as m from public.expenses where id = $1", [id]);
    expect(rows.rows[0].m).toBe("2026-08-01");
  });
});

describe("edição e exclusão preservam o histórico", () => {
  it("só quem lançou edita ou exclui", async () => {
    const id = await addExpense(carla, orgA, "Uber", 3200);
    await expect(rpc(bruno, "select public.delete_expense($1)", [id])).rejects.toThrow(/não encontrada/);
    await expect(
      rpc(ana, "select public.update_expense($1, 'Uber', 1, 'pix', '2026-09-10', null, null, null, false)", [id]),
    ).rejects.toThrow(/não encontrada/);
  });

  it("edição guarda a versão anterior e exclusão é lógica", async () => {
    const id = await addExpense(carla, orgA, "Cinema", 5000);
    await rpc(carla, "select public.update_expense($1, 'Cinema', 6000, 'pix', '2026-09-12', null, null, 'com pipoca', false)", [
      id,
    ]);
    await rpc(carla, "select public.delete_expense($1)", [id]);

    const history = await t.db.query<{ operation: string; amount: string }>(
      "select operation, previous->>'amount_cents' as amount from public.expense_history where expense_id = $1 order by id",
      [id],
    );
    expect(history.rows).toEqual([
      { operation: "update", amount: "5000" },
      { operation: "delete", amount: "6000" },
    ]);

    const visible = await read(carla, "select * from public.expenses where id = $1", [id]);
    expect(visible).toEqual([]);
    const stored = await t.db.query("select deleted_at from public.expenses where id = $1 and deleted_at is not null", [id]);
    expect(stored.rows).toHaveLength(1);
  });

  it("histórico é imutável e inacessível para clientes", async () => {
    await expect(t.db.query("delete from public.expense_history")).rejects.toThrow(/somente de inclusão/);
    await expect(read(ana, "select * from public.expense_history")).rejects.toThrow(/permission denied/);
  });

  it("excluir a organização remove despesas e histórico", async () => {
    const temp = await t.createUser("tmp@exemplo.com", "Tmp");
    const org = (await rpc<{ id: string }>(temp, "select public.create_organization('Temporária') as id"))[0].id;
    const id = await addExpense(temp, org, "Loja", 100);
    await rpc(temp, "select public.delete_expense($1)", [id]);
    await t.db.query("delete from public.organizations where id = $1", [org]);
    const left = await t.db.query<{ n: number }>(
      "select (select count(*) from public.expenses where org_id = $1) + (select count(*) from public.expense_history where org_id = $1) as n",
      [org],
    );
    expect(Number(left.rows[0].n)).toBe(0);
  });
});

describe("correções da revisão de privacidade", () => {
  it("digitar o nome de um fornecedor privado de outra pessoa não revela nada", async () => {
    const [{ id: saude }] = await read<{ id: string }>(
      ana,
      "select id from public.categories where org_id = $1 and name = 'Saúde'",
      [orgA],
    );
    await addExpense(carla, orgA, "Clínica Discreta", 30000, { private: true, category: saude });

    const danExpense = await addExpense(dan, orgA, "clínica   discreta", 100);
    const names = (await read<{ name: string }>(dan, "select name from public.suppliers where org_id = $1", [orgA])).map(
      (r) => r.name,
    );
    expect(names).toEqual(["clínica discreta"]);

    const stored = await t.db.query<{ category_id: string | null; owner_id: string }>(
      "select e.category_id, s.owner_id from public.expenses e join public.suppliers s on s.id = e.supplier_id where e.id = $1",
      [danExpense],
    );
    expect(stored.rows[0]).toEqual({ category_id: null, owner_id: dan.id });
  });

  it("colunas internas de fornecedores não são legíveis", async () => {
    await expect(read(ana, "select owner_id from public.suppliers")).rejects.toThrow(/permission denied/);
    await expect(read(ana, "select default_category_id from public.suppliers")).rejects.toThrow(/permission denied/);
  });

  it("competência muito distante da compra é recusada", async () => {
    await expect(
      rpc(ana, "select public.create_expense($1, 'Loja', 100, 'pix', '2026-09-10', null, '2099-01-01', null, false)", [orgA]),
    ).rejects.toThrow(/competência/);
  });

  it("edição recusa categoria arquivada", async () => {
    const id = await addExpense(ana, orgA, "Loja", 100);
    const [{ id: cat }] = (
      await t.db.query<{ id: string }>(
        "update public.categories set archived_at = now() where org_id = $1 and name = 'Outros' returning id",
        [orgA],
      )
    ).rows;
    await expect(
      rpc(ana, "select public.update_expense($1, 'Loja', 100, 'pix', '2026-09-10', $2, null, null, false)", [id, cat]),
    ).rejects.toThrow(/categoria inválida/);
  });

  it("excluir a conta apaga as despesas e o histórico da pessoa, e só dela", async () => {
    const leaving = await t.createUser("sai@exemplo.com", "Sai");
    const org = (await rpc<{ id: string }>(leaving, "select public.create_organization('Casa do Sai') as id"))[0].id;
    const id = await addExpense(leaving, org, "Mercado", 5000);
    await rpc(leaving, "select public.update_expense($1, 'Mercado', 6000, 'pix', '2026-09-10', null, null, null, false)", [id]);
    const before = await t.db.query<{ n: number }>("select count(*)::int as n from public.expenses");

    await t.db.query("delete from auth.users where id = $1", [leaving.id]);

    const left = await t.db.query<{ e: number; h: number; total: number }>(
      `select (select count(*) from public.expenses where owner_id = $1)::int as e,
              (select count(*) from public.expense_history where expense_id = $2)::int as h,
              (select count(*) from public.expenses)::int as total`,
      [leaving.id, id],
    );
    expect(left.rows[0]).toEqual({ e: 0, h: 0, total: before.rows[0].n - 1 });
  });
});
