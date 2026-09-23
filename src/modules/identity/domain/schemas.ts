import { z } from "zod";
import { ORG_ROLES } from "./roles";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.").max(254));

export const passwordSchema = z.string().min(12, "Use pelo menos 12 caracteres.").max(128, "Use no máximo 128 caracteres.");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe a senha."),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome.").max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "O código tem 6 dígitos.");

export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, "Use pelo menos 2 caracteres.")
  .max(80, "Use no máximo 80 caracteres.");

export const uuidSchema = z.uuid();

export const inviteSchema = z.object({
  orgId: uuidSchema,
  email: emailSchema,
  role: z.enum(ORG_ROLES).refine((role) => role !== "owner", "Papel inválido."),
});

export const memberRoleSchema = z.object({
  orgId: uuidSchema,
  userId: uuidSchema,
  role: z.enum(ORG_ROLES),
});

export const memberRefSchema = z.object({
  orgId: uuidSchema,
  userId: uuidSchema,
});
