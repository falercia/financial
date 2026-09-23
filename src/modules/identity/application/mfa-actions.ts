"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { totpCodeSchema } from "../domain/schemas";
import { fail, fromZodError, ok, type ActionResult } from "./result";
import { requireAuthenticated } from "./session";

export type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

/**
 * Inicia o cadastro do autenticador. Fatores TOTP não verificados de tentativas
 * anteriores são removidos antes, para não acumular lixo na conta.
 */
export async function startTotpEnrollment(): Promise<ActionResult<TotpEnrollment>> {
  await requireAuthenticated();
  const supabase = await createSupabaseServerClient();

  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp.some((factor) => factor.status === "verified")) {
    return fail("Você já tem um autenticador cadastrado.");
  }
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Autenticador ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error || !data) return fail("Não foi possível iniciar o cadastro do autenticador.");

  return ok({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
}

async function verifyFactor(factorId: string, rawCode: FormDataEntryValue | null): Promise<ActionResult> {
  const code = totpCodeSchema.safeParse(rawCode);
  if (!code.success) return fromZodError(code.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.data });
  if (error) return fail("Código incorreto ou expirado. Confira o horário do celular e tente de novo.");
  return ok(undefined);
}

/** Confirma o primeiro código do autenticador recém-cadastrado. */
export async function confirmTotpEnrollment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAuthenticated();
  const factorId = formData.get("factorId");
  if (typeof factorId !== "string" || factorId.length === 0) return fail("Cadastro expirado. Gere o QR code de novo.");

  const result = await verifyFactor(factorId, formData.get("code"));
  if (!result.ok) return result;
  redirect(safeNextPath(formData.get("next")));
}

/** Verificação no login, para quem já tem autenticador. */
export async function verifyTotpSignIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAuthenticated();
  const supabase = await createSupabaseServerClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === "verified");
  if (!factor) redirect("/mfa");

  const result = await verifyFactor(factor.id, formData.get("code"));
  if (!result.ok) return result;
  redirect(safeNextPath(formData.get("next")));
}
