/**
 * Papéis dentro de uma organização e regras de permissão.
 * O banco (RLS + funções) é a fonte de verdade; estas regras espelham as do
 * banco apenas para decidir o que a interface mostra.
 */
export const ORG_ROLES = ["owner", "admin", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ROLE_LABEL: Record<OrgRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
};

export const ROLE_DESCRIPTION: Record<OrgRole, string> = {
  owner: "Tudo, inclusive promover administradores e transferir a organização.",
  admin: "Vê todos os dados da organização e gerencia membros e convites.",
  member: "Lança e consulta apenas os próprios dados.",
};

export function isAdminRole(role: OrgRole): boolean {
  return role === "owner" || role === "admin";
}

/** Papéis que `actor` pode oferecer num convite. */
export function invitableRoles(actor: OrgRole): OrgRole[] {
  if (actor === "owner") return ["admin", "member"];
  if (actor === "admin") return ["member"];
  return [];
}

/** Papéis para os quais `actor` pode mudar alguém que hoje é `target`. */
export function assignableRoles(actor: OrgRole, target: OrgRole): OrgRole[] {
  if (actor === "owner") return [...ORG_ROLES];
  if (actor === "admin" && target === "member") return ["member"];
  return [];
}

export function canRemoveMember(actor: OrgRole, target: OrgRole, isSelf: boolean): boolean {
  if (isSelf) return true;
  if (actor === "owner") return true;
  return actor === "admin" && target === "member";
}
