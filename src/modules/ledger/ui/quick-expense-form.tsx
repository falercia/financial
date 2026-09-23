"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/field";
import { createExpense } from "../application/expense-actions";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHODS, QUICK_PAYMENT_METHODS, type PaymentMethod } from "../domain/expense";

type Props = {
  orgId: string;
  today: string;
  categories: { id: string; name: string }[];
  supplierNames: string[];
};

const inputClass = "min-h-12 w-full rounded-[10px] border bg-surface px-3.5 text-[15px]";

export function QuickExpenseForm({ orgId, today, categories, supplierNames }: Props) {
  const [state, action] = useActionState(createExpense, null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit_card");
  const formRef = useRef<HTMLFormElement>(null);
  const supplierRef = useRef<HTMLInputElement>(null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  // Depois de salvar: limpa, mantém a última forma de pagamento e volta ao primeiro campo.
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      supplierRef.current?.focus();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="paymentMethod" value={paymentMethod} />

      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="expense-supplier" className="text-ink-soft text-[13px] font-semibold">
            Fornecedor
          </label>
          <input
            ref={supplierRef}
            id="expense-supplier"
            name="supplier"
            list="expense-suppliers"
            autoComplete="off"
            autoFocus
            required
            maxLength={120}
            placeholder="Ex.: Condor, iFood, Copel"
            aria-invalid={errors?.supplier ? true : undefined}
            className={`${inputClass} ${errors?.supplier ? "border-danger" : "border-line-strong"}`}
          />
          <datalist id="expense-suppliers">
            {supplierNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {errors?.supplier ? <span className="text-danger-ink text-[12.5px]">{errors.supplier}</span> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="expense-amount" className="text-ink-soft text-[13px] font-semibold">
            Valor (R$)
          </label>
          <input
            id="expense-amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            required
            placeholder="187,90"
            aria-invalid={errors?.amountCents ? true : undefined}
            className={`${inputClass} tabular text-right text-lg font-semibold ${errors?.amountCents ? "border-danger" : "border-line-strong"}`}
          />
          {errors?.amountCents ? <span className="text-danger-ink text-[12.5px]">{errors.amountCents}</span> : null}
        </div>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-ink-soft mb-1.5 text-[13px] font-semibold">Forma de pagamento</legend>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.filter((m) => QUICK_PAYMENT_METHODS.includes(m) || m === paymentMethod).map((method) => (
            <button
              key={method}
              type="button"
              aria-pressed={paymentMethod === method}
              onClick={() => setPaymentMethod(method)}
              className={`min-h-10 rounded-full border px-4 text-sm ${
                paymentMethod === method ? "border-ink bg-ink font-semibold text-white" : "border-line-strong bg-surface text-ink"
              }`}
            >
              {PAYMENT_METHOD_LABEL[method]}
            </button>
          ))}
          <select
            aria-label="Outras formas de pagamento"
            value={QUICK_PAYMENT_METHODS.includes(paymentMethod) ? "" : paymentMethod}
            onChange={(event) => event.target.value && setPaymentMethod(event.target.value as PaymentMethod)}
            className="border-line-strong bg-surface min-h-10 rounded-full border px-3 text-sm"
          >
            <option value="">Outra…</option>
            {PAYMENT_METHODS.filter((m) => !QUICK_PAYMENT_METHODS.includes(m)).map((method) => (
              <option key={method} value={method}>
                {PAYMENT_METHOD_LABEL[method]}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <details className="group">
        <summary className="text-brand min-h-9 cursor-pointer text-[13.5px] font-medium">
          Mais detalhes (data, categoria, privado)
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="expense-date" className="text-ink-soft text-[13px] font-semibold">
              Data da compra
            </label>
            <input
              id="expense-date"
              name="purchaseDate"
              type="date"
              defaultValue={today}
              max={today}
              className={`${inputClass} border-line-strong`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="expense-category" className="text-ink-soft text-[13px] font-semibold">
              Categoria
            </label>
            <select id="expense-category" name="categoryId" defaultValue="" className={`${inputClass} border-line-strong`}>
              <option value="">Automática</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="expense-description" className="text-ink-soft text-[13px] font-semibold">
              Observação
            </label>
            <input id="expense-description" name="description" maxLength={280} className={`${inputClass} border-line-strong`} />
          </div>
          <label className="flex items-start gap-3 text-sm sm:col-span-2">
            <input type="checkbox" name="isPrivate" className="accent-brand mt-1 size-4" />
            <span>
              <strong className="font-medium">Despesa privada.</strong>{" "}
              <span className="text-muted">
                Administradores veem o valor apenas somado ao total do mês, sem fornecedor nem detalhe. Em organizações com poucas
                pessoas, o valor pode ser deduzido pelo total.
              </span>
            </span>
          </label>
        </div>
      </details>

      {state && !state.ok && !errors ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">{state.data.message}</Alert> : null}

      <SubmitButton className="min-h-12 text-[15px] font-semibold sm:self-start sm:px-8" pendingLabel="Salvando…">
        Registrar despesa
      </SubmitButton>
    </form>
  );
}
