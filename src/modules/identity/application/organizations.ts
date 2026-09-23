import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrgRole } from "../domain/roles";
import { requireMfaSession } from "./session";

export const ACTIVE_ORG_COOKIE = "active_org";

export type OrganizationSummary = {
  id: string;
  name: string;
  plan: string;
  seatLimit: number;
  role: OrgRole;
};

export type Member = {
  userId: string;
  fullName: string | null;
  role: OrgRole;
  joinedAt: string;
  isSelf: boolean;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: OrgRole;
  expiresAt: string;
  createdAt: string;
};

export type AuditEntry = {
  id: number;
  action: string;
  actorName: string | null;
  metadata: unknown;
  createdAt: string;
};

/** Organizações do usuário. O RLS garante que só as dele voltam. */
export const listMyOrganizations = cache(async (): Promise<OrganizationSummary[]> => {
  const session = await requireMfaSession();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, organizations(id, name, plan, seat_limit)")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error("Falha ao carregar organizações.");

  return (data ?? []).flatMap((row) =>
    row.organizations
      ? [
          {
            id: row.organizations.id,
            name: row.organizations.name,
            plan: row.organizations.plan,
            seatLimit: row.organizations.seat_limit,
            role: row.role,
          },
        ]
      : [],
  );
});

/**
 * Organização ativa: a escolhida no cookie, desde que o usuário seja membro;
 * senão, a primeira. O cookie é só preferência, nunca autorização.
 */
export const getActiveOrganization = cache(async (): Promise<OrganizationSummary | null> => {
  const organizations = await listMyOrganizations();
  if (organizations.length === 0) return null;
  const preferred = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  return organizations.find((org) => org.id === preferred) ?? organizations[0];
});

export async function listMembers(orgId: string): Promise<Member[]> {
  const session = await requireMfaSession();
  const supabase = await createSupabaseServerClient();

  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("user_id, role, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Falha ao carregar membros.");

  const ids = (memberships ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (memberships ?? []).map((m) => ({
    userId: m.user_id,
    fullName: names.get(m.user_id) ?? null,
    role: m.role,
    joinedAt: m.created_at,
    isSelf: m.user_id === session.userId,
  }));
}

export async function listPendingInvitations(orgId: string): Promise<PendingInvitation[]> {
  await requireMfaSession();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, role, expires_at, created_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error("Falha ao carregar convites.");
  return (data ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    expiresAt: i.expires_at,
    createdAt: i.created_at,
  }));
}

export async function listRecentAudit(orgId: string, limit = 20): Promise<AuditEntry[]> {
  await requireMfaSession();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, action, actor_id, metadata, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Falha ao carregar auditoria.");

  const actorIds = [...new Set((data ?? []).flatMap((e) => (e.actor_id ? [e.actor_id] : [])))];
  const { data: profiles } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (data ?? []).map((e) => ({
    id: e.id,
    action: e.action,
    actorName: e.actor_id ? (names.get(e.actor_id) ?? null) : null,
    metadata: e.metadata,
    createdAt: e.created_at,
  }));
}
