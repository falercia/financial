/**
 * Aceita apenas caminhos internos ("/algo"), bloqueando redirecionamento
 * aberto para outros domínios ("//evil.com", "https://...", "/\\evil.com").
 */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
