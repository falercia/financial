"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-subtle",
  ghost: "bg-transparent text-brand hover:bg-brand-soft",
  danger: "bg-transparent text-danger-ink hover:bg-danger-soft",
};

export function buttonClasses(variant: Variant = "primary", extra = "") {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${extra}`;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; pendingLabel?: string };

/** Botão de envio que desabilita e troca o texto enquanto a ação roda. */
export function SubmitButton({ variant = "primary", pendingLabel, children, className = "", ...rest }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || rest.disabled} className={buttonClasses(variant, className)} {...rest}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
