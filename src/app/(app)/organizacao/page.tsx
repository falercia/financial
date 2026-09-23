import type { Metadata } from "next";
import { SubmitButton } from "@/components/ui/button";
import { revokeInvitation } from "@/modules/identity/application/organization-actions";
import {
  getActiveOrganization,
  listMembers,
  listPendingInvitations,
  listRecentAudit,
} from "@/modules/identity/application/organizations";
import {
  assignableRoles,
  canRemoveMember,
  invitableRoles,
  isAdminRole,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  ORG_ROLES,
} from "@/modules/identity/domain/roles";
import { auditLabel, formatDateTime } from "@/modules/identity/ui/audit-labels";
import { InviteForm, MemberRoleForm, RemoveMemberForm } from "@/modules/identity/ui/organization-forms";

export const metadata: Metadata = { title: "Organização e membros" };

export default async function OrganizationPage() {
  const organization = await getActiveOrganization();
  if (!organization) return null;
  const isAdmin = isAdminRole(organization.role);

  const [members, invitations, audit] = await Promise.all([
    listMembers(organization.id),
    isAdmin ? listPendingInvitations(organization.id) : Promise.resolve([]),
    isAdmin ? listRecentAudit(organization.id) : Promise.resolve([]),
  ]);
  const seatsInUse = members.length + invitations.length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <span className="text-muted text-[13px]">Organização</span>
        <h1 className="font-serif text-[34px] font-medium">{organization.name}</h1>
        <p className="tabular text-muted text-sm">
          {seatsInUse} de {organization.seatLimit} lugares em uso, contando convites pendentes
        </p>
      </header>

      <section className="border-line bg-surface rounded-[14px] border p-6">
        <h2 className="font-serif text-xl font-medium">Membros</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-left text-[11.5px] font-semibold tracking-wide uppercase">
                <th className="py-2 pr-3">Pessoa</th>
                <th className="py-2 pr-3">Papel</th>
                <th className="py-2 pr-3">Desde</th>
                <th className="py-2" aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const roleOptions = member.isSelf ? [] : assignableRoles(organization.role, member.role);
                return (
                  <tr key={member.userId} className="border-line border-t">
                    <td className="py-3 pr-3 font-medium">
                      {member.fullName ?? "Sem nome"}
                      {member.isSelf ? <span className="text-muted ml-1.5 text-[12px] font-normal">(você)</span> : null}
                    </td>
                    <td className="py-3 pr-3">
                      {roleOptions.length > 1 ? (
                        <MemberRoleForm orgId={organization.id} userId={member.userId} role={member.role} options={roleOptions} />
                      ) : (
                        ROLE_LABEL[member.role]
                      )}
                    </td>
                    <td className="tabular text-muted py-3 pr-3">{formatDateTime(member.joinedAt)}</td>
                    <td className="py-3 text-right">
                      {canRemoveMember(organization.role, member.role, member.isSelf) ? (
                        <RemoveMemberForm orgId={organization.id} userId={member.userId} isSelf={member.isSelf} />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          {ORG_ROLES.map((role) => (
            <div key={role} className="bg-subtle rounded-[10px] p-3">
              <dt className="text-[13.5px] font-semibold">{ROLE_LABEL[role]}</dt>
              <dd className="text-ink-soft mt-0.5 text-[12.5px]">{ROLE_DESCRIPTION[role]}</dd>
            </div>
          ))}
        </dl>
      </section>

      {isAdmin ? (
        <section className="border-line bg-surface rounded-[14px] border p-6">
          <h2 className="font-serif text-xl font-medium">Convidar pessoa</h2>
          <p className="text-muted mt-1 text-[13px]">
            A pessoa cria a conta, ativa a verificação em duas etapas e aceita pelo link.
          </p>
          <div className="mt-4">
            <InviteForm orgId={organization.id} roles={invitableRoles(organization.role)} />
          </div>

          {invitations.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold">Convites pendentes</h3>
              <ul className="mt-2 flex flex-col">
                {invitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="border-line flex flex-wrap items-center justify-between gap-2 border-t py-3 text-sm"
                  >
                    <span>
                      <strong className="font-medium">{invitation.email}</strong>
                      <span className="text-muted">
                        {" "}
                        · {ROLE_LABEL[invitation.role]} · expira em {formatDateTime(invitation.expiresAt)}
                      </span>
                    </span>
                    <form action={revokeInvitation}>
                      <input type="hidden" name="invitationId" value={invitation.id} />
                      <SubmitButton variant="danger" className="min-h-9 px-3 text-[13px]" pendingLabel="Cancelando…">
                        Cancelar convite
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {isAdmin ? (
        <section className="border-line bg-surface rounded-[14px] border p-6">
          <h2 className="font-serif text-xl font-medium">Atividade recente</h2>
          <p className="text-muted mt-1 text-[13px]">Registro permanente. Nem administradores conseguem alterar ou apagar.</p>
          <ul className="mt-3 flex flex-col">
            {audit.map((entry) => (
              <li
                key={entry.id}
                className="border-line grid grid-cols-[140px_1fr] gap-3 border-t py-2.5 text-sm sm:grid-cols-[160px_220px_1fr]"
              >
                <span className="tabular text-muted">{formatDateTime(entry.createdAt)}</span>
                <span className="font-medium">{auditLabel(entry.action)}</span>
                <span className="text-muted max-sm:col-span-2">{entry.actorName ?? "Sistema"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
