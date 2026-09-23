import { z } from "zod";

/**
 * Variáveis públicas (vão para o navegador). Nunca coloque segredos aqui.
 * Lidas explicitamente para que o Next.js as substitua em tempo de build.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.url(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cached: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${missing}. Veja .env.example.`);
  }
  cached = parsed.data;
  return cached;
}
