"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/button";
import { Alert, Field } from "@/components/ui/field";
import { signInWithPassword } from "../application/auth-actions";

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInWithPassword, null);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state && !state.ok && !fieldErrors ? <Alert>{state.error}</Alert> : null}
      <Field label="E-mail" name="email" type="email" autoComplete="email" required error={fieldErrors?.email} />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={fieldErrors?.password}
      />
      <SubmitButton className="min-h-12 text-[15px] font-semibold" pendingLabel="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}
