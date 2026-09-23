import type { z } from "zod";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function fromZodError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    fieldErrors[key] ??= issue.message;
  }
  return fail("Revise os campos destacados.", fieldErrors);
}

/**
 * As funções do banco sinalizam erros de regra de negócio com SQLSTATE da
 * classe "FA" (ex.: FA403). Só essas mensagens chegam ao usuário; qualquer
 * outro erro (inclusive os internos do Postgres) vira uma mensagem genérica.
 */
export function fromDatabaseError(error: { code?: string; message: string } | null): ActionResult<never> {
  if (error?.code && /^FA\d{3}$/.test(error.code)) {
    return fail(capitalize(error.message));
  }
  return fail("Não foi possível concluir agora. Tente novamente.");
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1) + (text.endsWith(".") ? "" : ".");
}
