"use server";

import { refresh } from "next/cache";
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from "@/modules/identity/application/result";
import { requireMfaSession } from "@/modules/identity/application/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { newExpenseSchema } from "../domain/expense";
import { formatBRL } from "../domain/money";

export async function createExpense(
  _prev: ActionResult<{ message: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ message: string }>> {
  await requireMfaSession();
  const parsed = newExpenseSchema.safeParse({
    orgId: formData.get("orgId"),
    supplier: formData.get("supplier"),
    amountCents: formData.get("amount") ?? "",
    paymentMethod: formData.get("paymentMethod"),
    purchaseDate: formData.get("purchaseDate"),
    categoryId: formData.get("categoryId") ?? "",
    description: formData.get("description") ?? "",
    isPrivate: formData.get("isPrivate") === "on",
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const input = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_expense", {
    p_org_id: input.orgId,
    p_supplier_name: input.supplier,
    p_amount_cents: input.amountCents,
    p_payment_method: input.paymentMethod,
    p_purchase_date: input.purchaseDate,
    p_category_id: input.categoryId,
    p_description: input.description,
    p_is_private: input.isPrivate,
  });
  if (error) return fromDatabaseError(error);

  refresh();
  return ok({ message: `${input.supplier}: ${formatBRL(input.amountCents)} registrado.` });
}

export async function deleteExpense(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireMfaSession();
  const id = formData.get("expenseId");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return fail("Despesa inválida.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_expense", { p_expense_id: id });
  if (error) return fromDatabaseError(error);
  refresh();
  return ok(undefined);
}
