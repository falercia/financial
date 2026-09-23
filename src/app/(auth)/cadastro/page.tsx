import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath } from "@/lib/safe-redirect";
import { Divider, GoogleButton } from "@/modules/identity/ui/google-button";
import { SignUpForm } from "@/modules/identity/ui/sign-up-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage({ searchParams }: PageProps<"/cadastro">) {
  const next = safeNextPath((await searchParams).next);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[32px] font-medium">Criar conta</h1>
        <p className="text-muted text-sm">Depois do cadastro você configura a verificação em duas etapas.</p>
      </header>
      <GoogleButton next={next} />
      <Divider />
      <SignUpForm next={next} />
      <p className="text-muted text-center text-[13.5px]">
        Já tem conta?{" "}
        <Link href={`/entrar?next=${encodeURIComponent(next)}`} className="text-brand hover:text-brand-strong font-medium">
          Entrar
        </Link>
      </p>
    </div>
  );
}
