import { beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase, type TestUser } from "./harness";

/**
 * Cenário: duas organizações independentes.
 *   Org A (Família Garcia): ana (owner), bruno (admin), carla (member)
 *   Org B (Outra casa):     diego (owner)
 *   eva: usuária sem organização
 */
let t: TestDatabase;
let ana: TestUser, bruno: TestUser, carla: TestUser, diego: TestUser, eva: TestUser;
let orgA: string, orgB: string;

async function rpc<T = unknown>(user: TestUser, sql: string, params: unknown[] = [], aal: "aal1" | "aal2" = "aal2") {
  return t.as(user, async (tx) => (await tx.query<T>(sql, params)).rows, { aal, commit: true });
}

async function invite(by: TestUser, org: string, who: TestUser, role: "admin" | "member") {
  const rows = await rpc<{ token: string }>(by, "select public.create_invitation($1, $2, $3) as token", [org, who.email, role]);
  return rows[0].token;
}

beforeAll(async () => {
  t = await createTestDatabase();
  ana = await t.createUser("ana@exemplo.com", "Ana");
  bruno = await t.createUser("bruno@exemplo.com", "Bruno");
  carla = await t.createUser("carla@exemplo.com", "Carla");
  diego = await t.createUser("diego@exemplo.com", "Diego");
  eva = await t.createUser("eva@exemplo.com", "Eva");

  orgA = (await rpc<{ id: string }>(ana, "select public.create_organization('Família Garcia') as id"))[0].id;
  orgB = (await rpc<{ id: string }>(diego, "select public.create_organization('Outra casa') as id"))[0].id;

  await rpc(bruno, "select public.accept_invitation($1)", [await invite(ana, orgA, bruno, "admin")]);
  await rpc(carla, "select public.accept_invitation($1)", [await invite(ana, orgA, carla, "member")]);
});

describe("perfil criado no cadastro", () => {
  it("cria o perfil com o nome informado", async () => {
    const rows = await t.as(
      ana,
      async (tx) => (await tx.query<{ full_name: string }>("select full_name from public.profiles where id = $1", [ana.id])).rows,
    );
    expect(rows).toEqual([{ full_name: "Ana" }]);
  });
});

describe("isolamento entre organizações", () => {
  it("cada pessoa enxerga apenas as próprias organizações", async () => {
    const seenByAna = await t.as(ana, async (tx) => (await tx.query<{ id: string }>("select id from public.organizations")).rows);
    const seenByDiego = await t.as(
      diego,
      async (tx) => (await tx.query<{ id: string }>("select id from public.organizations")).rows,
    );
    expect(seenByAna.map((r) => r.id)).toEqual([orgA]);
    expect(seenByDiego.map((r) => r.id)).toEqual([orgB]);
  });

  it("consulta direta pelo id de outra organização não retorna nada", async () => {
    const rows = await t.as(
      diego,
      async (tx) => (await tx.query("select * from public.organizations where id = $1", [orgA])).rows,
    );
    expect(rows).toEqual([]);
  });

  it("membros, convites e auditoria de outra organização ficam invisíveis", async () => {
    const counts = await t.as(diego, async (tx) => {
      const q = async (sql: string) => Number((await tx.query<{ n: number }>(sql, [orgA])).rows[0].n);
      return {
        memberships: await q("select count(*) as n from public.memberships where org_id = $1"),
        invitations: await q("select count(*) as n from public.invitations where org_id = $1"),
        audit: await q("select count(*) as n from public.audit_log where org_id = $1"),
      };
    });
    expect(counts).toEqual({ memberships: 0, invitations: 0, audit: 0 });
  });

  it("perfis de pessoas de outra organização ficam invisíveis", async () => {
    const rows = await t.as(diego, async (tx) => (await tx.query<{ id: string }>("select id from public.profiles")).rows);
    expect(rows.map((r) => r.id)).toEqual([diego.id]);
  });

  it("não é possível alterar outra organização", async () => {
    const updated = await t.as(
      diego,
      async (tx) => (await tx.query("update public.organizations set name = 'invadida' where id = $1", [orgA])).affectedRows,
    );
    expect(updated).toBe(0);
  });

  it("não é possível convidar para outra organização", async () => {
    await expect(invite(diego, orgA, eva, "member")).rejects.toThrow(/sem permissão/);
  });

  it("não é possível remover pessoas de outra organização", async () => {
    await expect(rpc(diego, "select public.remove_member($1, $2)", [orgA, carla.id])).rejects.toThrow(/sem permissão/);
  });
});

describe("MFA obrigatório", () => {
  it("sessão sem segundo fator não lê nenhuma tabela", async () => {
    const rows = await t.as(
      ana,
      async (tx) => ({
        orgs: (await tx.query("select * from public.organizations")).rows.length,
        profiles: (await tx.query("select * from public.profiles")).rows.length,
        memberships: (await tx.query("select * from public.memberships")).rows.length,
      }),
      { aal: "aal1" },
    );
    expect(rows).toEqual({ orgs: 0, profiles: 0, memberships: 0 });
  });

  it("sessão sem segundo fator não executa operações", async () => {
    await expect(rpc(eva, "select public.create_organization('Sem MFA')", [], "aal1")).rejects.toThrow(/duas etapas/);
  });
});

describe("acesso anônimo", () => {
  it("o papel anon não tem permissão em nenhuma tabela", async () => {
    const attempt = t.db.transaction(async (tx) => {
      await tx.exec("set local role anon");
      await tx.query("select * from public.organizations");
    });
    await expect(attempt).rejects.toThrow(/permission denied/);
  });

  it("o papel anon não executa operações", async () => {
    const attempt = t.db.transaction(async (tx) => {
      await tx.exec("set local role anon");
      await tx.query("select public.create_organization('x')");
    });
    await expect(attempt).rejects.toThrow(/permission denied/);
  });
});

describe("escrita direta bloqueada", () => {
  it("não é possível se inserir como membro de uma organização", async () => {
    const attempt = t.as(eva, (tx) =>
      tx.query("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'owner')", [orgA, eva.id]),
    );
    await expect(attempt).rejects.toThrow(/permission denied/);
  });

  it("não é possível alterar plano ou limite de pessoas", async () => {
    const attempt = t.as(ana, (tx) => tx.query("update public.organizations set seat_limit = 999 where id = $1", [orgA]));
    await expect(attempt).rejects.toThrow(/permission denied/);
  });

  it("não é possível forjar registros de auditoria", async () => {
    const direct = t.as(ana, (tx) => tx.query("insert into public.audit_log (org_id, action) values ($1, 'x.y')", [orgA]));
    await expect(direct).rejects.toThrow(/permission denied/);
    const viaPrivate = t.as(ana, (tx) => tx.query("select private.audit($1, $2, 'x.y', null, null)", [orgA, ana.id]));
    await expect(viaPrivate).rejects.toThrow(/permission denied/);
  });

  it("auditoria é imutável até para o dono do banco", async () => {
    await expect(t.db.query("update public.audit_log set action = 'x.y'")).rejects.toThrow(/somente de inclusão/);
    await expect(t.db.query("delete from public.audit_log")).rejects.toThrow(/somente de inclusão/);
  });
});

describe("papéis dentro da organização", () => {
  it("membro comum não vê convites nem auditoria", async () => {
    const counts = await t.as(carla, async (tx) => ({
      invitations: (await tx.query("select * from public.invitations")).rows.length,
      audit: (await tx.query("select * from public.audit_log")).rows.length,
    }));
    expect(counts).toEqual({ invitations: 0, audit: 0 });
  });

  it("administrador vê a auditoria da organização", async () => {
    const actions = await t.as(bruno, async (tx) =>
      (await tx.query<{ action: string }>("select action from public.audit_log order by id")).rows.map((r) => r.action),
    );
    expect(actions).toContain("organization.created");
    expect(actions).toContain("membership.joined");
  });

  it("membro comum não convida", async () => {
    await expect(invite(carla, orgA, eva, "member")).rejects.toThrow(/sem permissão/);
  });

  it("administrador não convida outro administrador", async () => {
    await expect(invite(bruno, orgA, eva, "admin")).rejects.toThrow(/apenas o proprietário/);
  });

  it("administrador não remove o proprietário", async () => {
    await expect(rpc(bruno, "select public.remove_member($1, $2)", [orgA, ana.id])).rejects.toThrow(/sem permissão/);
  });

  it("o único proprietário não pode sair nem ser rebaixado", async () => {
    await expect(rpc(ana, "select public.remove_member($1, $2)", [orgA, ana.id])).rejects.toThrow(/ao menos um proprietário/);
    await expect(rpc(ana, "select public.update_member_role($1, $2, 'member')", [orgA, ana.id])).rejects.toThrow(
      /ao menos um proprietário/,
    );
  });

  it("regra de visibilidade financeira: admin vê tudo, membro vê só o seu", async () => {
    const check = (user: TestUser, owner: TestUser) =>
      t.as(
        user,
        async (tx) =>
          (await tx.query<{ ok: boolean }>("select private.can_access_owned($1, $2) as ok", [orgA, owner.id])).rows[0].ok,
      );
    expect(await check(ana, carla)).toBe(true);
    expect(await check(bruno, carla)).toBe(true);
    expect(await check(carla, carla)).toBe(true);
    expect(await check(carla, bruno)).toBe(false);
    expect(await check(diego, diego)).toBe(false);
  });
});

describe("convites", () => {
  it("guarda apenas o hash do token", async () => {
    const token = await invite(ana, orgA, eva, "member");
    const stored = await t.db.query<{ n: number }>(
      "select count(*)::int as n from public.invitations where token_hash = sha256(convert_to($1, 'UTF8'))",
      [token],
    );
    expect(stored.rows[0].n).toBe(1);
    const plain = await t.db.query<{ n: number }>(
      "select count(*)::int as n from public.invitations where encode(token_hash, 'escape') like '%' || $1 || '%'",
      [token],
    );
    expect(plain.rows[0].n).toBe(0);
  });

  it("convite só pode ser aceito pelo e-mail convidado", async () => {
    const token = await invite(ana, orgA, eva, "member");
    await expect(rpc(diego, "select public.accept_invitation($1)", [token])).rejects.toThrow(/convite inválido/);
  });

  it("convite revogado ou expirado não funciona", async () => {
    const token = await invite(ana, orgA, eva, "member");
    const [{ id }] = (
      await t.db.query<{ id: string }>("select id from public.invitations where token_hash = sha256(convert_to($1, 'UTF8'))", [
        token,
      ])
    ).rows;
    await rpc(ana, "select public.revoke_invitation($1)", [id]);
    await expect(rpc(eva, "select public.accept_invitation($1)", [token])).rejects.toThrow(/convite inválido/);

    const token2 = await invite(ana, orgA, eva, "member");
    await t.db.query(
      "update public.invitations set expires_at = now() - interval '1 minute' where token_hash = sha256(convert_to($1, 'UTF8'))",
      [token2],
    );
    await expect(rpc(eva, "select public.accept_invitation($1)", [token2])).rejects.toThrow(/convite inválido/);
  });

  it("token inexistente recebe a mesma resposta de token inválido", async () => {
    await expect(rpc(eva, "select public.accept_invitation('nao-existe')")).rejects.toThrow(/convite inválido/);
  });

  it("respeita o limite de pessoas do plano", async () => {
    const small = (await rpc<{ id: string }>(diego, "select public.create_organization('Plano pequeno') as id"))[0].id;
    await t.db.query("update public.organizations set seat_limit = 2 where id = $1", [small]);
    await invite(diego, small, eva, "member");
    await expect(invite(diego, small, carla, "member")).rejects.toThrow(/limite de pessoas/);
  });
});

describe("correções da revisão de segurança", () => {
  it("erros de regra de negócio usam códigos próprios (classe FA)", async () => {
    const error = await invite(carla, orgA, eva, "member").catch((e: { code?: string }) => e);
    expect(error).toMatchObject({ code: "FA403" });
  });

  it("conta com e-mail não confirmado não aceita convite", async () => {
    const unconfirmed = await t.createUser("naoconfirmado@exemplo.com", "Sem confirmação", { confirmed: false });
    const token = await invite(ana, orgA, unconfirmed, "member");
    await expect(rpc(unconfirmed, "select public.accept_invitation($1)", [token])).rejects.toThrow(/convite inválido/);
  });

  it("convite perde validade quando quem convidou perde a autoridade", async () => {
    const org = (await rpc<{ id: string }>(diego, "select public.create_organization('Autoridade') as id"))[0].id;
    const gabi = await t.createUser("gabi@exemplo.com", "Gabi");
    const hugo = await t.createUser("hugo@exemplo.com", "Hugo");
    await rpc(gabi, "select public.accept_invitation($1)", [await invite(diego, org, gabi, "admin")]);

    const tokenFromGabi = await invite(gabi, org, hugo, "member");
    await rpc(diego, "select public.update_member_role($1, $2, 'member')", [org, gabi.id]);

    await expect(rpc(hugo, "select public.accept_invitation($1)", [tokenFromGabi])).rejects.toThrow(/convite inválido/);
  });

  it("administrador não cancela nem substitui convite de administrador feito pelo proprietário", async () => {
    const org = (await rpc<{ id: string }>(diego, "select public.create_organization('Hierarquia') as id"))[0].id;
    const ines = await t.createUser("ines@exemplo.com", "Inês");
    const joao = await t.createUser("joao@exemplo.com", "João");
    await rpc(ines, "select public.accept_invitation($1)", [await invite(diego, org, ines, "admin")]);

    const ownerToken = await invite(diego, org, joao, "admin");
    const [{ id }] = (
      await t.db.query<{ id: string }>("select id from public.invitations where token_hash = sha256(convert_to($1, 'UTF8'))", [
        ownerToken,
      ])
    ).rows;

    await expect(rpc(ines, "select public.revoke_invitation($1)", [id])).rejects.toThrow(/não encontrado/);
    await expect(invite(ines, org, joao, "member")).rejects.toThrow(/convite do proprietário/);
    await expect(rpc(joao, "select public.accept_invitation($1)", [ownerToken])).resolves.toBeDefined();
  });

  it("renomear a organização fica registrado na auditoria", async () => {
    await t.as(ana, (tx) => tx.query("update public.organizations set name = 'Família Garcia Silva' where id = $1", [orgA]), {
      commit: true,
    });
    const actions = await t.as(ana, async (tx) =>
      (await tx.query<{ action: string }>("select action from public.audit_log where org_id = $1", [orgA])).rows.map(
        (r) => r.action,
      ),
    );
    expect(actions).toContain("organization.renamed");
  });

  it("usuário anônimo não acessa dados mesmo com aal2", async () => {
    const rows = await t.as(ana, async (tx) => (await tx.query("select * from public.organizations")).rows, {
      claims: { is_anonymous: true },
    });
    expect(rows).toEqual([]);
  });

  it("apenas as funções das políticas são executáveis por authenticated e nenhuma por anon", async () => {
    const result = await t.db.query<{ name: string; authenticated: boolean; anon: boolean }>(`
      select p.proname as name,
             has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
             has_function_privilege('anon', p.oid, 'execute') as anon
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private'
      order by 1`);
    expect(result.rows.filter((r) => r.anon)).toEqual([]);
    expect(result.rows.filter((r) => r.authenticated).map((r) => r.name)).toEqual([
      "admin_org_ids",
      "can_access_owned",
      "co_member_ids",
      "has_mfa",
      "org_role",
      "user_org_ids",
    ]);
  });

  it("excluir uma conta funciona e preserva a auditoria", async () => {
    const temp = await t.createUser("temporario@exemplo.com", "Temporário");
    const org = (await rpc<{ id: string }>(temp, "select public.create_organization('Temporária') as id"))[0].id;
    await t.db.query("delete from auth.users where id = $1", [temp.id]);
    const audit = await t.db.query<{ n: number }>("select count(*)::int as n from public.audit_log where org_id = $1", [org]);
    expect(audit.rows[0].n).toBeGreaterThan(0);
  });

  it("excluir uma organização remove seus dados, inclusive a auditoria", async () => {
    const temp = await t.createUser("encerrar@exemplo.com", "Encerrar");
    const org = (await rpc<{ id: string }>(temp, "select public.create_organization('Encerrada') as id"))[0].id;
    await t.db.query("delete from public.organizations where id = $1", [org]);
    const left = await t.db.query<{ n: number }>(
      "select (select count(*) from public.audit_log where org_id = $1) + (select count(*) from public.memberships where org_id = $1) as n",
      [org],
    );
    expect(Number(left.rows[0].n)).toBe(0);
  });
});
