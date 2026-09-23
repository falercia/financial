/**
 * Dinheiro sempre em centavos inteiros. Nada de ponto flutuante em cálculo.
 */
export const MAX_AMOUNT_CENTS = 100_000_000_000; // R$ 1 bilhão

/**
 * Converte o que a pessoa digitou em centavos. Aceita "187,90", "187.90",
 * "1.234,56", "R$ 1.234", "1234". Retorna null quando o texto é ambíguo ou inválido.
 */
export function parseBRLToCents(input: string): number | null {
  const text = input.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!/^\d[\d.,]*$/.test(text)) return null;

  let integerPart: string;
  let decimalPart = "";

  const lastComma = text.lastIndexOf(",");
  if (lastComma >= 0) {
    // Vírgula é o separador decimal; pontos antes dela são milhar.
    integerPart = text.slice(0, lastComma);
    decimalPart = text.slice(lastComma + 1);
    if (decimalPart.includes(".") || integerPart.includes(",")) return null;
    if (integerPart.includes(".") && !/^\d{1,3}(\.\d{3})+$/.test(integerPart)) return null;
    integerPart = integerPart.replace(/\./g, "");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    integerPart = text.replace(/\./g, ""); // "1.234" = mil duzentos e trinta e quatro
  } else if (/^\d+\.\d{1,2}$/.test(text)) {
    [integerPart, decimalPart] = text.split("."); // "187.90"
  } else if (/^\d+$/.test(text)) {
    integerPart = text;
  } else {
    return null;
  }

  if (decimalPart.length > 2 || !/^\d*$/.test(decimalPart) || integerPart.length === 0) return null;
  const cents = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_AMOUNT_CENTS) return null;
  return cents;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  // Divisão só para exibir; o valor armazenado continua inteiro.
  return brl.format(cents / 100);
}
