import { describe, expect, it } from "vitest";
import { formatBRL, parseBRLToCents } from "./money";

describe("parseBRLToCents", () => {
  it.each([
    ["187,90", 18790],
    ["187,9", 18790],
    ["187.90", 18790],
    ["1.234,56", 123456],
    ["1.234", 123400],
    ["R$ 1.234,56", 123456],
    ["1234", 123400],
    ["0,01", 1],
    ["12.345.678,90", 1234567890],
  ])("%s → %i centavos", (input, cents) => {
    expect(parseBRLToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "0", "0,00", "-10", "1,234,56", "1.23.4", "10,999", "1,2.3", "12.34.56"])("rejeita %s", (input) => {
    expect(parseBRLToCents(input)).toBeNull();
  });
});

describe("formatBRL", () => {
  it("formata em reais", () => {
    expect(formatBRL(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });
});
