import { describe, expect, it } from "vitest";
import { inviteSchema, signUpSchema, totpCodeSchema } from "./schemas";

describe("validação de entrada", () => {
  it("normaliza e-mail do convite", () => {
    const parsed = inviteSchema.parse({
      orgId: "8f14e45f-ceea-4e7a-9f3b-2a1c5b6d7e8f",
      email: "  Pessoa@Exemplo.COM ",
      role: "member",
    });
    expect(parsed.email).toBe("pessoa@exemplo.com");
  });

  it("não aceita convite para proprietário", () => {
    const result = inviteSchema.safeParse({
      orgId: "8f14e45f-ceea-4e7a-9f3b-2a1c5b6d7e8f",
      email: "a@b.com",
      role: "owner",
    });
    expect(result.success).toBe(false);
  });

  it("exige senha longa no cadastro", () => {
    const result = signUpSchema.safeParse({ fullName: "Ana", email: "a@b.com", password: "curta" });
    expect(result.success).toBe(false);
  });

  it("código de verificação tem 6 dígitos", () => {
    expect(totpCodeSchema.safeParse("123456").success).toBe(true);
    expect(totpCodeSchema.safeParse("12345").success).toBe(false);
    expect(totpCodeSchema.safeParse("abcdef").success).toBe(false);
  });
});
