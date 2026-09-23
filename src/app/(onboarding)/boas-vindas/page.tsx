import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listMyOrganizations } from "@/modules/identity/application/organizations";
import { CreateOrganizationForm } from "@/modules/identity/ui/organization-forms";

export const metadata: Metadata = { title: "Boas-vindas" };

export default async function WelcomePage({ searchParams }: PageProps<"/boas-vindas">) {
  const organizations = await listMyOrganizations();
  const creatingAnother = (await searchParams).nova === "1";
  if (organizations.length > 0 && !creatingAnother) redirect("/");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-medium">{creatingAnother ? "Nova organização" : "Boas-vindas"}</h1>
        <p className="text-muted text-sm">
          Tudo o que você registrar fica dentro de uma organização, isolada de qualquer outra. Recebeu um convite? Abra o link do
          convite em vez de criar uma nova.
        </p>
      </header>
      <CreateOrganizationForm />
      {creatingAnother ? (
        <Link href="/" className="text-brand hover:text-brand-strong text-center text-[13.5px]">
          Voltar
        </Link>
      ) : null}
    </div>
  );
}
