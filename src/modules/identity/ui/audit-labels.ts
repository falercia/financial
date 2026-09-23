const LABELS: Record<string, string> = {
  "organization.created": "Organização criada",
  "invitation.created": "Convite enviado",
  "invitation.revoked": "Convite cancelado",
  "membership.joined": "Pessoa entrou",
  "membership.role_changed": "Papel alterado",
  "membership.removed": "Pessoa removida",
  "membership.left": "Pessoa saiu",
};

export function auditLabel(action: string): string {
  return LABELS[action] ?? action;
}

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}
