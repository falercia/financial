"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { inviteSchema, memberRefSchema, memberRoleSchema, organizationNameSchema, uuidSchema } from "../domain/schemas";
import { ACTIVE_ORG_COOKIE, listMyOrganizations } from "./organizations";
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from "./result";
import { requireMfaSession } from "./session";

const ACTIVE_ORG_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

async function setActiveOrganization(orgId: string) {
  (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, ACTIVE_ORG_COOKIE_OPTIONS);
}

export async function createOrganization(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireMfaSession();
  const name = organizationNameSchema.safeParse(formData.get("name"));
  if (!name.success) return fromZodError(name.error);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_organization", { p_name: name.data });
  if (error || !data) return fromDatabaseError(error);

  await setActiveOrganization(data);
  redirect("/");
}

export async function switchOrganization(formData: FormData): Promise<void> {
  await requireMfaSession();
  const orgId = uuidSchema.safeParse(formData.get("orgId"));
  if (!orgId.success) return;
  // Só grava se o usuário for membro; o cookie nunca concede acesso por si.
  const organizations = await listMyOrganizations();
  if (organizations.some((org) => org.id === orgId.data)) {
    await setActiveOrganization(orgId.data);
  }
  refresh();
}

export async function createInvitation(
  _prev: ActionResult<{ link: string; email: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ link: string; email: string }>> {
  await requireMfaSession();
  const parsed = inviteSchema.safeParse({
    orgId: formData.get("orgId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data: token, error } = await supabase.rpc("create_invitation", {
    p_org_id: parsed.data.orgId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error || !token) return fromDatabaseError(error);

  refresh();
  return ok({ link: `${publicEnv().NEXT_PUBLIC_APP_URL}/convite/${token}`, email: parsed.data.email });
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  await requireMfaSession();
  const id = uuidSchema.safeParse(formData.get("invitationId"));
  if (!id.success) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("revoke_invitation", { p_invitation_id: id.data });
  refresh();
}

export async function updateMemberRole(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireMfaSession();
  const parsed = memberRoleSchema.safeParse({
    orgId: formData.get("orgId"),
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_member_role", {
    p_org_id: parsed.data.orgId,
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });
  if (error) return fromDatabaseError(error);
  refresh();
  return ok(undefined);
}

export async function removeMember(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requireMfaSession();
  const parsed = memberRefSchema.safeParse({ orgId: formData.get("orgId"), userId: formData.get("userId") });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("remove_member", { p_org_id: parsed.data.orgId, p_user_id: parsed.data.userId });
  if (error) return fromDatabaseError(error);

  if (parsed.data.userId === session.userId) redirect("/");
  refresh();
  return ok(undefined);
}

export async function acceptInvitation(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireMfaSession();
  const token = formData.get("token");
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return fail("Convite inválido ou expirado.");

  const supabase = await createSupabaseServerClient();
  const { data: orgId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error || !orgId) return fromDatabaseError(error);

  await setActiveOrganization(orgId);
  redirect("/");
}
