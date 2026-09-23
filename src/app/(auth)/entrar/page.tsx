import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/field";
import { safeNextPath } from "@/lib/safe-redirect";
import { Divider, GoogleButton } from "@/modules/identity/ui/google-button";
import { SignInForm } from "@/modules/identity/ui/sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  google: "Não foi possível entrar com o Google. Tente novamente.",
  link: "Link de acesso inválido ou expirado.",
};

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const error = typeof params.erro === "string" ? ERRORS[params.erro] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[32px] font-medium">Entrar</h1>
        <p className="text-muted text-sm">Use sua conta Google ou e-mail e senha.</p>
      </header>
      {error ? <Alert>{error}</Alert> : null}
      <GoogleButton next={next} />
      <Divider />
      <SignInForm next={next} />
      <p className="text-muted text-center text-[13.5px]">
        Ainda não tem conta?{" "}
        <Link href={`/cadastro?next=${encodeURIComponent(next)}`} className="text-brand hover:text-brand-strong font-medium">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
