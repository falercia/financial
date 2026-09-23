"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/button";
import { Alert, Field } from "@/components/ui/field";
import { signUpWithPassword } from "../application/auth-actions";

export function SignUpForm({ next }: { next: string }) {
  const [state, action] = useActionState(signUpWithPassword, null);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  if (state?.ok) {
    return (
      <Alert tone="success">
        Enviamos um link de confirmação para o seu e-mail. Abra o link para ativar a conta e depois cadastre o autenticador.
      </Alert>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state && !state.ok && !fieldErrors ? <Alert>{state.error}</Alert> : null}
      <Field label="Nome" name="fullName" autoComplete="name" required error={fieldErrors?.fullName} />
      <Field label="E-mail" name="email" type="email" autoComplete="email" required error={fieldErrors?.email} />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={fieldErrors?.password}
        hint="Pelo menos 12 caracteres. Senhas que já vazaram são recusadas."
      />
      <SubmitButton className="min-h-12 text-[15px] font-semibold" pendingLabel="Criando conta…">
        Criar conta
      </SubmitButton>
    </form>
  );
}
