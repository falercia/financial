import type { Metadata } from "next";
import { requireMfaSession } from "@/modules/identity/application/session";
import { AcceptInvitationForm } from "@/modules/identity/ui/organization-forms";

export const metadata: Metadata = { title: "Convite", referrer: "no-referrer" };

export default async function InvitationPage({ params }: PageProps<"/convite/[token]">) {
  const session = await requireMfaSession();
  const { token } = await params;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-medium">Convite para organização</h1>
        <p className="text-muted text-sm">
          Você está entrando como <strong className="text-ink">{session.email}</strong>. O convite só funciona para o e-mail
          convidado.
        </p>
      </header>
      <AcceptInvitationForm token={token} />
    </div>
  );
}
