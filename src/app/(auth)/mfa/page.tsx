import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "@/modules/identity/application/auth-actions";
import { requireAuthenticated } from "@/modules/identity/application/session";
import { MfaEnrollFlow, MfaVerifyForm } from "@/modules/identity/ui/mfa-forms";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

export default async function MfaPage({ searchParams }: PageProps<"/mfa">) {
  const session = await requireAuthenticated();
  const next = safeNextPath((await searchParams).next);
  if (session.aal === "aal2") redirect(next);

  const supabase = await createSupabaseServerClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedFactor = factors?.totp.some((factor) => factor.status === "verified") ?? false;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[32px] font-medium">
          {hasVerifiedFactor ? "Verificação em duas etapas" : "Proteja sua conta"}
        </h1>
        <p className="text-muted text-sm">
          {hasVerifiedFactor
            ? "Digite o código do seu aplicativo autenticador."
            : "A verificação em duas etapas é obrigatória. Nenhum dado financeiro é liberado sem ela."}
        </p>
      </header>
      {hasVerifiedFactor ? <MfaVerifyForm next={next} /> : <MfaEnrollFlow next={next} />}
      <form action={signOut}>
        <button type="submit" className={buttonClasses("ghost", "w-full")}>
          Sair e entrar com outra conta
        </button>
      </form>
    </div>
  );
}
