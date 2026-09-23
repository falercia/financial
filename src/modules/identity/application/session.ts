import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Session = {
  userId: string;
  email: string | null;
  aal: "aal1" | "aal2";
};

/**
 * Sessão verificada (assinatura do JWT validada por getClaims), memorizada
 * durante uma renderização. É a camada de acesso: toda página e toda ação
 * passam por aqui, independentemente do que o proxy fez.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const { claims } = data;
  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
  };
});

/** Usuário autenticado, com ou sem MFA. Use só nas telas de MFA. */
export async function requireAuthenticated(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/entrar");
  return session;
}

/** Usuário autenticado e com segundo fator verificado. Padrão para todo o app. */
export async function requireMfaSession(): Promise<Session> {
  const session = await requireAuthenticated();
  if (session.aal !== "aal2") redirect("/mfa");
  return session;
}
