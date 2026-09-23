import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Cookies de sessão inacessíveis ao JavaScript da página (o app não usa cliente
 * Supabase no navegador) e enviados só por HTTPS em produção. Reduz o impacto
 * de um eventual XSS: o token de renovação não pode ser lido por script.
 *
 * A validade do cookie é fixada pela biblioteca; o tempo de vida real da sessão
 * é controlado no Supabase (Authentication > Sessions).
 */
export const SESSION_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};
