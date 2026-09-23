import { z } from "zod";
import { parseBRLToCents } from "./money";

export const PAYMENT_METHODS = ["credit_card", "debit_card", "pix", "boleto", "cash", "transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  credit_card: "Crédito",
  debit_card: "Débito",
  pix: "Pix",
  boleto: "Boleto",
  cash: "Dinheiro",
  transfer: "Transferência",
  other: "Outro",
};

/** Formas mostradas como botões no cadastro rápido; as demais ficam em "mais detalhes". */
export const QUICK_PAYMENT_METHODS: PaymentMethod[] = ["credit_card", "pix", "debit_card", "boleto"];

const TIME_ZONE = "America/Sao_Paulo";

/** Data de hoje no fuso de São Paulo, no formato AAAA-MM-DD. */
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Primeiro dia do mês (AAAA-MM-01) a partir de "AAAA-MM" ou do mês atual. */
export function monthStart(param?: string | null, now = new Date()): string {
  if (param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param)) return `${param}-01`;
  return `${todayISO(now).slice(0, 7)}-01`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function monthParam(month: string): string {
  return month.slice(0, 7);
}

export function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, m - 1, 1)),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDay(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${d}/${m}`;
}

export const newExpenseSchema = z.object({
  orgId: z.uuid(),
  supplier: z.string().trim().min(1, "Informe o fornecedor.").max(120, "Use no máximo 120 caracteres."),
  amountCents: z.string().transform((value, ctx) => {
    const cents = parseBRLToCents(value);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Valor inválido. Ex.: 187,90" });
      return z.NEVER;
    }
    return cents;
  }),
  paymentMethod: z.enum(PAYMENT_METHODS, "Escolha a forma de pagamento."),
  purchaseDate: z.iso.date("Data inválida."),
  categoryId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((value) => value || null),
  description: z
    .string()
    .trim()
    .max(280, "Use no máximo 280 caracteres.")
    .optional()
    .transform((value) => value || null),
  isPrivate: z.boolean(),
});

export type NewExpense = z.infer<typeof newExpenseSchema>;
