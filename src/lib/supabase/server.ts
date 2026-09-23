import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import { SESSION_COOKIE_OPTIONS } from "./cookie-options";
import type { Database } from "./database.types";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Usa o JWT do próprio usuário: toda consulta passa pelas políticas de RLS.
 * Crie um cliente por requisição; nunca compartilhe entre requisições.
 */
export async function createSupabaseServerClient() {
  const env = publicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components não podem gravar cookies. O proxy renova a sessão
          // a cada requisição, então ignorar aqui é seguro.
        }
      },
    },
  });
}
