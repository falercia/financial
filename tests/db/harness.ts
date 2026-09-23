import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const root = join(__dirname, "..", "..");

export type TestUser = { id: string; email: string };
export type Aal = "aal1" | "aal2";

/**
 * Banco Postgres em memória com o shim do Supabase e todas as migrações aplicadas,
 * na mesma ordem em que o Supabase CLI aplicaria.
 */
export async function createTestDatabase() {
  const db = new PGlite();
  await db.exec(readFileSync(join(root, "tests/db/supabase-shim.sql"), "utf8"));

  const migrationsDir = join(root, "supabase/migrations");
  for (const file of readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }

  return {
    db,

    async createUser(email: string, fullName = email.split("@")[0], options: { confirmed?: boolean } = {}): Promise<TestUser> {
      const result = await db.query<{ id: string }>(
        "insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ($1, $2, $3) returning id",
        [email, options.confirmed === false ? null : new Date().toISOString(), JSON.stringify({ full_name: fullName })],
      );
      return { id: result.rows[0].id, email };
    },

    /**
     * Executa `fn` como o usuário informado, com o papel "authenticated" e as
     * claims do JWT, exatamente como o PostgREST faz. Tudo ocorre numa transação
     * que é desfeita ao final, exceto quando `commit` é true.
     */
    async as<T>(
      user: TestUser,
      fn: (tx: Transaction) => Promise<T>,
      options: { aal?: Aal; commit?: boolean; claims?: Record<string, unknown> } = {},
    ): Promise<T> {
      const claims = JSON.stringify({
        sub: user.id,
        email: user.email,
        role: "authenticated",
        aal: options.aal ?? "aal2",
        ...options.claims,
      });
      let output: T | undefined;
      await db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
        await tx.exec("set local role authenticated");
        output = await fn(tx);
        if (!options.commit) {
          await tx.rollback();
        }
      });
      return output as T;
    },
  };
}

export type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>;
