import type { Metadata } from "next";
import Link from "next/link";
import { getActiveOrganization, listMembers } from "@/modules/identity/application/organizations";
import { isAdminRole } from "@/modules/identity/domain/roles";
import { hasAnyExpense } from "@/modules/ledger/application/expenses";

export const metadata: Metadata = { title: "Visão geral" };

type Step = { label: string; detail: string; done: boolean; href?: string };

export default async function OverviewPage() {
  const organization = await getActiveOrganization();
  if (!organization) return null;
  const [members, hasExpense] = await Promise.all([listMembers(organization.id), hasAnyExpense(organization.id)]);
  const canInvite = isAdminRole(organization.role);

  const steps: Step[] = [
    { label: "Conta protegida", detail: "Verificação em duas etapas ativa.", done: true },
    { label: "Organização criada", detail: organization.name, done: true },
    {
      label: "Convidar pessoas",
      detail: canInvite
        ? "Cada pessoa vê só os próprios lançamentos. Administradores veem tudo."
        : "Apenas administradores convidam.",
      done: members.length > 1,
      href: canInvite ? "/organizacao" : undefined,
    },
    {
      label: "Registrar a primeira despesa",
      detail: "Fornecedor, valor e forma de pagamento. Leva menos de 10 segundos.",
      done: hasExpense,
      href: "/despesas",
    },
    { label: "Vincular seu WhatsApp", detail: "Mande despesas por mensagem, foto ou áudio.", done: false },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[34px] font-medium">Visão geral</h1>
        <p className="text-muted text-sm">{organization.name}</p>
      </header>

      <section className="border-line bg-surface rounded-[14px] border p-6">
        <h2 className="font-serif text-xl font-medium">Primeiros passos</h2>
        <ol className="mt-4 flex flex-col">
          {steps.map((step) => (
            <li key={step.label} className="border-line flex items-start gap-3 border-t py-3.5 first:border-t-0">
              <span
                aria-hidden="true"
                className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  step.done ? "bg-positive text-white" : "border-line-strong text-muted border-[1.5px]"
                }`}
              >
                {step.done ? "✓" : ""}
              </span>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {step.label}
                  <span className="sr-only">{step.done ? " (concluído)" : " (pendente)"}</span>
                </span>
                <span className="text-muted text-[13px]">{step.detail}</span>
              </div>
              {step.href && !step.done ? (
                <Link href={step.href} className="text-brand hover:text-brand-strong text-[13px] font-medium">
                  Fazer agora
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="border-line-strong bg-subtle text-ink-soft rounded-[14px] border border-dashed p-6 text-sm">
        Os indicadores de gastos, pagamentos, compromissos e orçamento aparecem aqui assim que houver lançamentos. Nenhum valor é
        exibido sem dado real por trás.
      </section>
    </div>
  );
}
