import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireMfaSession } from "@/modules/identity/application/session";
import type { PaymentMethod } from "../domain/expense";

export type ExpenseRow = {
  id: string;
  supplierName: string;
  categoryName: string | null;
  ownerName: string | null;
  isOwn: boolean;
  isPrivate: boolean;
  amountCents: number;
  paymentMethod: PaymentMethod;
  purchaseDate: string;
  description: string | null;
};

export type MonthSummary = {
  totalCents: number;
  visibleCents: number;
  hiddenPrivateCents: number;
  count: number;
};

export type CategoryOption = { id: string; name: string };

/**
 * Despesas do mês de competência. O RLS decide o que volta: as próprias
 * e, para administradores, as não privadas das outras pessoas.
 */
export async function listMonthExpenses(orgId: string, month: string): Promise<ExpenseRow[]> {
  const session = await requireMfaSession();
  const supabase = await createSupabaseServerClient();

  const { data: expenses, error } = await supabase
    .from("expenses")
    .select("id, owner_id, supplier_id, category_id, amount_cents, payment_method, purchase_date, description, is_private")
    .eq("org_id", orgId)
    .eq("competence_month", month)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Falha ao carregar despesas.");
  if (!expenses?.length) return [];

  const supplierIds = [...new Set(expenses.map((e) => e.supplier_id))];
  const categoryIds = [...new Set(expenses.flatMap((e) => (e.category_id ? [e.category_id] : [])))];
  const ownerIds = [...new Set(expenses.map((e) => e.owner_id))];

  const [suppliers, categories, owners] = await Promise.all([
    supabase.from("suppliers").select("id, name").in("id", supplierIds),
    categoryIds.length ? supabase.from("categories").select("id, name").in("id", categoryIds) : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("id, full_name").in("id", ownerIds),
  ]);

  const supplierName = new Map((suppliers.data ?? []).map((s) => [s.id, s.name]));
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
  const ownerName = new Map((owners.data ?? []).map((p) => [p.id, p.full_name]));

  return expenses.map((e) => ({
    id: e.id,
    supplierName: supplierName.get(e.supplier_id) ?? "Fornecedor",
    categoryName: e.category_id ? (categoryName.get(e.category_id) ?? null) : null,
    ownerName: ownerName.get(e.owner_id) ?? null,
    isOwn: e.owner_id === session.userId,
    isPrivate: e.is_private,
    amountCents: Number(e.amount_cents),
    paymentMethod: e.payment_method,
    purchaseDate: e.purchase_date,
    description: e.description,
  }));
}

export async function getMonthSummary(orgId: string, month: string): Promise<MonthSummary> {
  await requireMfaSession();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("expense_month_summary", { p_org_id: orgId, p_month: month });
  if (error) throw new Error("Falha ao calcular o total do mês.");
  const row = data?.[0];
  return {
    totalCents: Number(row?.total_cents ?? 0),
    visibleCents: Number(row?.visible_cents ?? 0),
    hiddenPrivateCents: Number(row?.hidden_private_cents ?? 0),
    count: Number(row?.expense_count ?? 0),
  };
}

export async function listCategories(orgId: string): Promise<CategoryOption[]> {
  await requireMfaSession();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("org_id", orgId)
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error("Falha ao carregar categorias.");
  return data ?? [];
}

/** Fornecedores visíveis para sugerir enquanto a pessoa digita. */
export async function listSupplierNames(orgId: string): Promise<string[]> {
  await requireMfaSession();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("suppliers").select("name").eq("org_id", orgId).order("name").limit(300);
  if (error) throw new Error("Falha ao carregar fornecedores.");
  // Cada pessoa tem a própria lista; administradores podem ver nomes repetidos entre pessoas.
  return [...new Set((data ?? []).map((s) => s.name))];
}

/** Se a pessoa já registrou (ou pode ver) alguma despesa na organização. */
export async function hasAnyExpense(orgId: string): Promise<boolean> {
  await requireMfaSession();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("expenses").select("id").eq("org_id", orgId).limit(1);
  return (data?.length ?? 0) > 0;
}
