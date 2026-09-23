import { describe, expect, it } from "vitest";
import { monthLabel, monthStart, newExpenseSchema, shiftMonth, todayISO } from "./expense";

describe("datas e meses", () => {
  it("usa o fuso de São Paulo para o dia de hoje", () => {
    // 02:30 UTC de 1º de outubro ainda é 30 de setembro em São Paulo.
    expect(todayISO(new Date("2026-10-01T02:30:00Z"))).toBe("2026-09-30");
  });

  it("aceita só meses válidos no parâmetro", () => {
    const now = new Date("2026-09-23T12:00:00Z");
    expect(monthStart("2026-02", now)).toBe("2026-02-01");
    expect(monthStart("2026-13", now)).toBe("2026-09-01");
    expect(monthStart("'; drop", now)).toBe("2026-09-01");
  });

  it("navega entre meses atravessando o ano", () => {
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01");
  });

  it("escreve o mês por extenso", () => {
    expect(monthLabel("2026-09-01")).toBe("Setembro de 2026");
  });
});

describe("cadastro rápido", () => {
  const base = {
    orgId: "8f14e45f-ceea-4e7a-9f3b-2a1c5b6d7e8f",
    supplier: " Condor ",
    amountCents: "187,90",
    paymentMethod: "pix",
    purchaseDate: "2026-09-23",
    categoryId: "",
    description: "",
    isPrivate: false,
  };

  it("converte valor e limpa campos opcionais", () => {
    const parsed = newExpenseSchema.parse(base);
    expect(parsed).toMatchObject({ supplier: "Condor", amountCents: 18790, categoryId: null, description: null });
  });

  it("recusa valor inválido com mensagem clara", () => {
    const result = newExpenseSchema.safeParse({ ...base, amountCents: "abc" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/Valor inválido/);
  });
});
