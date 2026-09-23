import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/proxy-session";

/**
 * Checagem otimista de acesso. A proteção real acontece no servidor
 * (camada de sessão em cada página e ação) e no banco (RLS). Aqui só
 * renovamos a sessão e encaminhamos para login ou MFA o quanto antes.
 */
const PUBLIC_PATHS = ["/entrar", "/cadastro", "/auth/callback"];
const MFA_PATHS = ["/mfa"];

function matches(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function proxy(request: NextRequest) {
  const { response, cacheHeaders, userId, aal } = await refreshSession(request);
  const { pathname, search } = request.nextUrl;

  if (matches(pathname, PUBLIC_PATHS)) {
    return response;
  }

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    for (const [key, value] of Object.entries(cacheHeaders)) {
      redirect.headers.set(key, value);
    }
    return redirect;
  };

  if (!userId) {
    return redirectTo("/entrar");
  }

  if (aal !== "aal2" && !matches(pathname, MFA_PATHS)) {
    return redirectTo("/mfa");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
