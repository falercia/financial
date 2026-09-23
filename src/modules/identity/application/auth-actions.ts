"use server";

import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema } from "../domain/schemas";
import { fail, fromZodError, ok, type ActionResult } from "./result";

const GENERIC_SIGN_IN_ERROR = "E-mail ou senha incorretos.";

export async function signInWithPassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Mensagem única para não revelar quais e-mails têm conta.
    return fail(error.code === "email_not_confirmed" ? "Confirme seu e-mail antes de entrar." : GENERIC_SIGN_IN_ERROR);
  }

  redirect(`/mfa?next=${encodeURIComponent(safeNextPath(formData.get("next")))}`);
}

export async function signUpWithPassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const next = safeNextPath(formData.get("next"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    if (error.code === "weak_password") return fail("Senha fraca ou já exposta em vazamentos. Escolha outra.");
    return fail("Não foi possível criar a conta agora. Tente novamente.");
  }
  // Resposta idêntica para e-mail novo ou existente (não revela contas).
  return ok(undefined);
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next"));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${publicEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) redirect("/entrar?erro=google");
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
