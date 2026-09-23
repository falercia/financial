#!/usr/bin/env node
/**
 * Verificação do ambiente antes de rodar ou publicar o app.
 * Só faz leituras e chamadas que o próprio Supabase recusa: não altera nada.
 *
 * Uso: npm run verificar            (lê .env.local)
 *      npm run verificar -- .env.production.local
 */
import { existsSync } from "node:fs";

const envFile = process.argv[2] ?? ".env.local";
const results = [];
const ok = (msg) => results.push({ status: "ok", msg });
const fail = (msg, hint) => results.push({ status: "falha", msg, hint });
const warn = (msg, hint) => results.push({ status: "aviso", msg, hint });

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
  ok(`Arquivo ${envFile} encontrado`);
} else {
  warn(`Arquivo ${envFile} não encontrado; usando variáveis do ambiente`, "cp .env.example .env.local");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

function checkEnv() {
  if (/^(https:\/\/[a-z0-9-]+\.supabase\.co|http:\/\/(127\.0\.0\.1|localhost):\d+)\/?$/.test(url))
    ok("NEXT_PUBLIC_SUPABASE_URL no formato esperado");
  else fail("NEXT_PUBLIC_SUPABASE_URL ausente ou inválida", "Supabase > Project Settings > API: https://SEU_REF.supabase.co");

  if (key.startsWith("sb_secret_") || /service_role/.test(decodeJwtRole(key))) {
    fail(
      "A chave configurada é SECRETA. Ela nunca pode ir para o navegador",
      "Troque pela chave publishable (sb_publishable_...) e gere uma nova chave secreta no Supabase",
    );
  } else if (key.startsWith("sb_publishable_") || decodeJwtRole(key) === "anon") {
    ok("Chave pública (publishable) configurada");
  } else {
    fail(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ausente ou em formato desconhecido",
      "Supabase > Project Settings > API Keys > Publishable key",
    );
  }

  if (/^https?:\/\/[^/]+\/?$/.test(appUrl)) {
    ok(`NEXT_PUBLIC_APP_URL = ${appUrl}`);
    if (appUrl.startsWith("http://") && !/localhost|127\.0\.0\.1/.test(appUrl)) {
      fail("NEXT_PUBLIC_APP_URL usa http fora do localhost", "Em produção use https");
    }
  } else {
    fail("NEXT_PUBLIC_APP_URL ausente ou com caminho", "Ex.: http://localhost:3000 ou https://seu-dominio");
  }
}

function decodeJwtRole(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return "";
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role ?? "";
  } catch {
    return "";
  }
}

async function request(path, init = {}) {
  const response = await fetch(`${url.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: { apikey: key, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(10_000),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

async function checkAuthSettings() {
  const { status, body } = await request("/auth/v1/settings");
  if (status !== 200 || !body) {
    fail(`Não foi possível ler as configurações de autenticação (HTTP ${status})`, "Confira a URL e a chave pública");
    return;
  }
  ok("Supabase Auth respondeu");
  if (body.external?.google) ok("Login com Google habilitado");
  else fail("Login com Google desabilitado", "Authentication > Providers > Google");
  if (body.external?.email) ok("Login com e-mail habilitado");
  else warn("Login com e-mail desabilitado", "Authentication > Providers > Email");
  if (body.mailer_autoconfirm === false) ok("Confirmação de e-mail obrigatória");
  else fail("E-mails são confirmados automaticamente", "Authentication > Providers > Email: ligue 'Confirm email'");
  if (body.anonymous_users) fail("Login anônimo está ligado", "Authentication > Settings: desligue anonymous sign-ins");
  warn(
    "MFA por aplicativo (TOTP) não é verificável daqui",
    "Confira em Authentication > Multi-Factor: App Authenticator habilitado",
  );
}

async function checkDatabase() {
  const rpc = await request("/rest/v1/rpc/create_organization", {
    method: "POST",
    body: JSON.stringify({ p_name: "verificacao" }),
  });
  const rpcCode = rpc.body?.code;
  if (rpcCode === "PGRST202") {
    fail(
      "Migrações não aplicadas: a função create_organization não existe",
      "npm run db:link -- --project-ref SEU_REF && npm run db:push",
    );
    return;
  }
  if (rpc.status >= 200 && rpc.status < 300) {
    fail("CRÍTICO: um visitante anônimo conseguiu executar uma operação", "Não publique. Revise os privilégios da migração");
    return;
  }
  if (rpcCode === "42501") ok("Migrações aplicadas e operações bloqueadas para anônimos");
  else warn(`Resposta inesperada ao testar operações (HTTP ${rpc.status}, ${rpcCode ?? "sem código"})`);

  const table = await request("/rest/v1/organizations?select=id&limit=1");
  const tableCode = table.body?.code;
  if (table.status === 200) {
    fail("Visitante anônimo consegue consultar a tabela organizations", "Não publique. Revise os privilégios da migração");
  } else if (tableCode === "42501") {
    ok("Tabelas bloqueadas para anônimos");
  } else if (tableCode === "PGRST205") {
    fail("Tabela organizations não encontrada", "npm run db:push");
  } else {
    warn(`Resposta inesperada ao testar tabelas (HTTP ${table.status}, ${tableCode ?? "sem código"})`);
  }
}

checkEnv();
if (!results.some((r) => r.status === "falha")) {
  try {
    await checkAuthSettings();
    await checkDatabase();
  } catch (error) {
    fail(`Sem conexão com o Supabase: ${error.message}`, "Confira a URL, a internet e se o projeto não está pausado");
  }
}

const icon = { ok: "✔", aviso: "!", falha: "✘" };
console.log("\nVerificação do ambiente\n");
for (const r of results) {
  console.log(`  ${icon[r.status]} ${r.msg}`);
  if (r.hint && r.status !== "ok") console.log(`      → ${r.hint}`);
}
const failures = results.filter((r) => r.status === "falha").length;
console.log(failures ? `\n${failures} problema(s) para resolver antes de continuar.\n` : "\nTudo certo para rodar o app.\n");
process.exit(failures ? 1 : 0);
