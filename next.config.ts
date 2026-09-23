import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança aplicados a todas as respostas.
 * A política de scripts com nonce (CSP completa) entra na fase de robustez;
 * aqui já bloqueamos embutir o app em iframes, objetos e envio de formulários
 * para outros domínios.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self' https://accounts.google.com" + (supabaseUrl ? ` ${supabaseUrl}` : ""),
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  `connect-src 'self'${supabaseUrl ? ` ${supabaseUrl}` : ""}`,
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
