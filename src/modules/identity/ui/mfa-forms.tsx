"use client";

import { useActionState, useState, useTransition } from "react";
import { buttonClasses, SubmitButton } from "@/components/ui/button";
import { Alert, Field } from "@/components/ui/field";
import { confirmTotpEnrollment, startTotpEnrollment, verifyTotpSignIn, type TotpEnrollment } from "../application/mfa-actions";

function CodeField({ error }: { error?: string }) {
  return (
    <Field
      label="Código de 6 dígitos"
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="\d{6}"
      maxLength={6}
      required
      autoFocus
      error={error}
      className="tabular text-2xl tracking-[0.4em]"
    />
  );
}

export function MfaVerifyForm({ next }: { next: string }) {
  const [state, action] = useActionState(verifyTotpSignIn, null);
  const error = state && !state.ok ? (state.fieldErrors?.code ?? state.error) : undefined;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <CodeField error={error} />
      <SubmitButton className="min-h-12 text-[15px] font-semibold" pendingLabel="Verificando…">
        Verificar e entrar
      </SubmitButton>
    </form>
  );
}

export function MfaEnrollFlow({ next }: { next: string }) {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();
  const [state, action] = useActionState(confirmTotpEnrollment, null);
  const error = state && !state.ok ? (state.fieldErrors?.code ?? state.error) : undefined;

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-4">
        {startError ? <Alert>{startError}</Alert> : null}
        <ol className="text-ink-soft flex list-decimal flex-col gap-1.5 pl-5 text-sm">
          <li>Instale um aplicativo autenticador (Google Authenticator, 1Password, Authy ou similar).</li>
          <li>Gere o QR code abaixo e leia com o aplicativo.</li>
          <li>Digite o código de 6 dígitos que aparecer.</li>
        </ol>
        <button
          type="button"
          disabled={starting}
          className={buttonClasses("primary", "min-h-12 text-[15px] font-semibold")}
          onClick={() =>
            startTransition(async () => {
              const result = await startTotpEnrollment();
              if (result.ok) {
                setEnrollment(result.data);
                setStartError(null);
              } else {
                setStartError(result.error);
              }
            })
          }
        >
          {starting ? "Gerando…" : "Gerar QR code"}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="factorId" value={enrollment.factorId} />
      <div className="border-line bg-surface flex flex-col items-center gap-3 rounded-[12px] border p-5">
        {/* QR em data URI gerado pelo Supabase; next/image não agrega nada aqui. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enrollment.qrCode} alt="QR code para cadastrar o autenticador" width={184} height={184} />
        <details className="text-muted w-full text-center text-[12.5px]">
          <summary className="cursor-pointer">Não consegue ler o QR code?</summary>
          <p className="text-ink mt-2 font-mono text-[13px] break-all">{enrollment.secret}</p>
        </details>
      </div>
      <CodeField error={error} />
      <SubmitButton className="min-h-12 text-[15px] font-semibold" pendingLabel="Confirmando…">
        Confirmar e entrar
      </SubmitButton>
    </form>
  );
}
