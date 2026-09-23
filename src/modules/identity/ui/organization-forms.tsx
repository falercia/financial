"use client";

import { useActionState, useState } from "react";
import { buttonClasses, SubmitButton } from "@/components/ui/button";
import { Alert, Field } from "@/components/ui/field";
import {
  acceptInvitation,
  createInvitation,
  createOrganization,
  removeMember,
  updateMemberRole,
} from "../application/organization-actions";
import { ROLE_LABEL, type OrgRole } from "../domain/roles";

export function CreateOrganizationForm() {
  const [state, action] = useActionState(createOrganization, null);
  const fieldError = state && !state.ok ? state.fieldErrors?.form : undefined;
  return (
    <form action={action} className="flex flex-col gap-4">
      {state && !state.ok && !fieldError ? <Alert>{state.error}</Alert> : null}
      <Field
        label="Nome da organização"
        name="name"
        placeholder="Ex.: Família Garcia"
        required
        maxLength={80}
        error={fieldError}
        hint="Pode ser só você ou a sua casa. Dá para convidar pessoas depois."
      />
      <SubmitButton className="min-h-12 text-[15px] font-semibold" pendingLabel="Criando…">
        Criar organização
      </SubmitButton>
    </form>
  );
}

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitation, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton className="min-h-12 text-[15px] font-semibold" pendingLabel="Entrando na organização…">
        Aceitar convite
      </SubmitButton>
    </form>
  );
}

export function InviteForm({ orgId, roles }: { orgId: string; roles: OrgRole[] }) {
  const [state, action] = useActionState(createInvitation, null);
  const [copied, setCopied] = useState(false);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  const whatsappText =
    state?.ok &&
    encodeURIComponent(
      `Você foi convidado para organizar as finanças comigo. Aceite pelo link (vale por 7 dias): ${state.data.link}`,
    );

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <input type="hidden" name="orgId" value={orgId} />
        <Field label="E-mail da pessoa" name="email" type="email" required error={fieldErrors?.email} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-role" className="text-ink-soft text-[13px] font-semibold">
            Papel
          </label>
          <select
            id="invite-role"
            name="role"
            defaultValue="member"
            className="border-line-strong bg-surface min-h-12 rounded-[10px] border px-3 text-[15px]"
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton className="min-h-12" pendingLabel="Gerando…">
          Gerar convite
        </SubmitButton>
      </form>

      {state && !state.ok && !fieldErrors ? <Alert>{state.error}</Alert> : null}

      {state?.ok ? (
        <div className="bg-brand-soft text-brand-strong flex flex-col gap-3 rounded-[12px] p-4 text-sm">
          <p>
            Convite criado para <strong>{state.data.email}</strong>. Envie o link abaixo. Ele vale por 7 dias e só funciona para
            esse e-mail. Por segurança, ele não será mostrado de novo.
          </p>
          <code className="bg-surface text-ink rounded-lg px-3 py-2 font-mono text-[12.5px] break-all">{state.data.link}</code>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClasses("secondary")}
              onClick={async () => {
                await navigator.clipboard.writeText(state.data.link);
                setCopied(true);
              }}
            >
              {copied ? "Link copiado" : "Copiar link"}
            </button>
            <a
              href={`https://wa.me/?text=${whatsappText}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("secondary")}
            >
              Enviar pelo WhatsApp
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MemberRoleForm({
  orgId,
  userId,
  role,
  options,
}: {
  orgId: string;
  userId: string;
  role: OrgRole;
  options: OrgRole[];
}) {
  const [state, action] = useActionState(updateMemberRole, null);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={role}
        aria-label="Papel"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="border-line-strong bg-surface min-h-9 rounded-lg border px-2 text-[13px]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {ROLE_LABEL[option]}
          </option>
        ))}
      </select>
      {state && !state.ok ? <span className="text-danger-ink text-[12px]">{state.error}</span> : null}
    </form>
  );
}

export function RemoveMemberForm({ orgId, userId, isSelf }: { orgId: string; userId: string; isSelf: boolean }) {
  const [state, action] = useActionState(removeMember, null);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className={buttonClasses("danger", "min-h-9 px-3 text-[13px]")} onClick={() => setConfirming(true)}>
        {isSelf ? "Sair" : "Remover"}
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="userId" value={userId} />
      <div className="flex gap-1">
        <SubmitButton variant="danger" className="min-h-9 px-3 text-[13px]" pendingLabel="…">
          Confirmar
        </SubmitButton>
        <button type="button" className={buttonClasses("ghost", "min-h-9 px-3 text-[13px]")} onClick={() => setConfirming(false)}>
          Cancelar
        </button>
      </div>
      {state && !state.ok ? <span className="text-danger-ink text-[12px]">{state.error}</span> : null}
    </form>
  );
}
