"use client";

import { useActionState, useState } from "react";
import { buttonClasses, SubmitButton } from "@/components/ui/button";
import { deleteExpense } from "../application/expense-actions";

export function DeleteExpenseButton({ expenseId, label }: { expenseId: string; label: string }) {
  const [state, action] = useActionState(deleteExpense, null);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        aria-label={`Excluir ${label}`}
        className={buttonClasses("ghost", "min-h-9 px-2 text-[13px]")}
        onClick={() => setConfirming(true)}
      >
        Excluir
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center justify-end gap-1">
      <input type="hidden" name="expenseId" value={expenseId} />
      <SubmitButton variant="danger" className="min-h-9 px-2 text-[13px]" pendingLabel="…">
        Confirmar
      </SubmitButton>
      <button type="button" className={buttonClasses("ghost", "min-h-9 px-2 text-[13px]")} onClick={() => setConfirming(false)}>
        Cancelar
      </button>
      {state && !state.ok ? <span className="text-danger-ink text-[12px]">{state.error}</span> : null}
    </form>
  );
}
