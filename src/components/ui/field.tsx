import type { InputHTMLAttributes, ReactNode } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
};

export function Field({ label, name, error, hint, id, className = "", ...input }: FieldProps) {
  const inputId = id ?? `field-${name}`;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-ink-soft text-[13px] font-semibold">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`bg-surface min-h-12 rounded-[10px] border px-3.5 text-[15px] ${error ? "border-danger" : "border-line-strong"} ${className}`}
        {...input}
      />
      {error ? (
        <span id={`${inputId}-error`} className="text-danger-ink text-[12.5px]">
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="text-muted text-[12.5px]">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function Alert({ tone = "danger", children }: { tone?: "danger" | "info" | "success"; children: ReactNode }) {
  const tones = {
    danger: "bg-danger-soft text-danger-ink",
    info: "bg-brand-soft text-brand-strong",
    success: "bg-positive-soft text-positive-ink",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-[10px] px-3.5 py-3 text-[13.5px] ${tones[tone]}`}>
      {children}
    </div>
  );
}
