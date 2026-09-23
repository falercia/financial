import type { Metadata } from "next";
import Link from "next/link";
import { getActiveOrganization } from "@/modules/identity/application/organizations";
import { isAdminRole } from "@/modules/identity/domain/roles";
import { getMonthSummary, listCategories, listMonthExpenses, listSupplierNames } from "@/modules/ledger/application/expenses";
import {
  formatDay,
  monthLabel,
  monthParam,
  monthStart,
  PAYMENT_METHOD_LABEL,
  shiftMonth,
  todayISO,
} from "@/modules/ledger/domain/expense";
import { formatBRL } from "@/modules/ledger/domain/money";
import { DeleteExpenseButton } from "@/modules/ledger/ui/delete-expense-button";
import { QuickExpenseForm } from "@/modules/ledger/ui/quick-expense-form";

export const metadata: Metadata = { title: "Despesas" };

export default async function ExpensesPage({ searchParams }: PageProps<"/despesas">) {
  const organization = await getActiveOrganization();
  if (!organization) return null;

  const params = await searchParams;
  const month = monthStart(typeof params.mes === "string" ? params.mes : null);
  const today = todayISO();
  const isCurrentMonth = monthParam(month) === today.slice(0, 7);
  const isAdmin = isAdminRole(organization.role);

  const [expenses, summary, categories, supplierNames] = await Promise.all([
    listMonthExpenses(organization.id, month),
    getMonthSummary(organization.id, month),
    listCategories(organization.id),
    listSupplierNames(organization.id),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-serif text-[34px] font-medium">Despesas</h1>
          <p className="text-muted text-sm">Referência: competência (mês da compra)</p>
        </div>
        <nav aria-label="Mês" className="flex items-center gap-2">
          <Link
            href={`/despesas?mes=${monthParam(shiftMonth(month, -1))}`}
            className="border-line-strong bg-surface flex min-h-10 items-center rounded-[10px] border px-3 text-sm"
            aria-label="Mês anterior"
          >
            ‹
          </Link>
          <span className="min-w-40 text-center text-sm font-semibold">{monthLabel(month)}</span>
          <Link
            href={`/despesas?mes=${monthParam(shiftMonth(month, 1))}`}
            className="border-line-strong bg-surface flex min-h-10 items-center rounded-[10px] border px-3 text-sm"
            aria-label="Próximo mês"
          >
            ›
          </Link>
          {!isCurrentMonth ? (
            <Link href="/despesas" className="text-brand ml-1 text-[13px] font-medium">
              Mês atual
            </Link>
          ) : null}
        </nav>
      </header>

      <section aria-label="Registrar despesa" className="border-line bg-surface rounded-[14px] border p-6">
        <QuickExpenseForm orgId={organization.id} today={today} categories={categories} supplierNames={supplierNames} />
      </section>

      <section aria-label="Resumo do mês" className="grid gap-4 sm:grid-cols-3">
        <div className="border-line bg-surface flex flex-col gap-1 rounded-[14px] border p-5">
          <span className="text-muted text-[12px] font-semibold tracking-wide uppercase">Total do mês</span>
          <span className="tabular font-serif text-[30px] font-medium">{formatBRL(summary.totalCents)}</span>
          <span className="text-muted text-[12.5px]">
            {isAdmin ? "Todas as pessoas da organização" : "Somente as suas despesas"}
          </span>
        </div>
        <div className="border-line bg-surface flex flex-col gap-1 rounded-[14px] border p-5">
          <span className="text-muted text-[12px] font-semibold tracking-wide uppercase">Lançamentos</span>
          <span className="tabular font-serif text-[30px] font-medium">{summary.count}</span>
          <span className="text-muted text-[12.5px]">visíveis para você</span>
        </div>
        {isAdmin && summary.hiddenPrivateCents > 0 ? (
          <div className="border-line bg-subtle flex flex-col gap-1 rounded-[14px] border p-5">
            <span className="text-muted text-[12px] font-semibold tracking-wide uppercase">Privadas de outras pessoas</span>
            <span className="tabular font-serif text-[30px] font-medium">{formatBRL(summary.hiddenPrivateCents)}</span>
            <span className="text-muted text-[12.5px]">Incluídas no total, sem detalhe</span>
          </div>
        ) : null}
      </section>

      <section aria-label="Despesas do mês" className="border-line bg-surface rounded-[14px] border p-2 sm:p-4">
        {expenses.length === 0 ? (
          <p className="text-ink-soft p-6 text-center text-sm">
            Nenhuma despesa em {monthLabel(month).toLowerCase()}. Registre a primeira acima: fornecedor, valor e forma de
            pagamento bastam.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-left text-[11.5px] font-semibold tracking-wide uppercase">
                  <th className="px-2 py-2">Data</th>
                  <th className="px-2 py-2">Fornecedor</th>
                  <th className="px-2 py-2">Categoria</th>
                  <th className="px-2 py-2">Forma</th>
                  {isAdmin ? <th className="px-2 py-2">Pessoa</th> : null}
                  <th className="px-2 py-2 text-right">Valor</th>
                  <th className="px-2 py-2" aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-line border-t">
                    <td className="tabular text-muted px-2 py-3">{formatDay(expense.purchaseDate)}</td>
                    <td className="px-2 py-3">
                      <span className="font-medium">{expense.supplierName}</span>
                      {expense.isPrivate ? (
                        <span className="bg-brand-soft text-brand-strong ml-2 rounded-full px-2 py-0.5 text-[10.5px] font-semibold">
                          PRIVADA
                        </span>
                      ) : null}
                      {expense.description ? <span className="text-muted block text-[12.5px]">{expense.description}</span> : null}
                    </td>
                    <td className="text-ink-soft px-2 py-3">{expense.categoryName ?? "Sem categoria"}</td>
                    <td className="text-ink-soft px-2 py-3">{PAYMENT_METHOD_LABEL[expense.paymentMethod]}</td>
                    {isAdmin ? (
                      <td className="text-ink-soft px-2 py-3">{expense.isOwn ? "Você" : (expense.ownerName ?? "Membro")}</td>
                    ) : null}
                    <td className="tabular px-2 py-3 text-right font-semibold">{formatBRL(expense.amountCents)}</td>
                    <td className="px-2 py-3 text-right">
                      {expense.isOwn ? <DeleteExpenseButton expenseId={expense.id} label={expense.supplierName} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
