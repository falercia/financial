import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { SESSION_COOKIE_OPTIONS } from "./cookie-options";
import type { Database } from "./database.types";

export type ProxySession = {
  response: NextResponse;
  /** Cabeçalhos anti-cache exigidos quando cookies de sessão são gravados. */
  cacheHeaders: Record<string, string>;
  userId: string | null;
  aal: string | null;
};

/**
 * Renova a sessão (tokens em cookies) e devolve as claims verificadas.
 * getClaims() valida a assinatura do JWT; nunca confiamos em getSession() aqui.
 */
export async function refreshSession(request: NextRequest): Promise<ProxySession> {
  const env = publicEnv();
  let response = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        cacheHeaders = headers;
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  return {
    response,
    cacheHeaders,
    userId: typeof claims?.sub === "string" ? claims.sub : null,
    aal: typeof claims?.aal === "string" ? claims.aal : null,
  };
}
