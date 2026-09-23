import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Retorno do Google (OAuth com PKCE) e dos links de confirmação de e-mail.
 * Troca o código pela sessão e segue para a verificação em duas etapas.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // Base fixa da configuração, nunca derivada do cabeçalho Host.
  const origin = publicEnv().NEXT_PUBLIC_APP_URL;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(`/mfa?next=${encodeURIComponent(next)}`, origin));
    }
  }

  return NextResponse.redirect(new URL("/entrar?erro=link", origin));
}
