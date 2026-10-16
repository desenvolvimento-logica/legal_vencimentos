/** Rótulos das ações gravadas em legal_audit_logs (legal_006/016/018/022). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  EXPIRATION_CREATED: "Criou vencimento",
  EXPIRATION_UPDATED: "Editou vencimento",
  EXPIRATION_RESPONSIBLE_CHANGED: "Trocou responsável",
  EXPIRATION_QUOTE_SENT: "Enviou orçamento",
  EXPIRATION_QUOTE_WITHDRAWN: "Orçamento recusado",
  EXPIRATION_RENEWAL_STARTED: "Iniciou renovação",
  EXPIRATION_RENEWAL_ABANDONED: "Desistiu da renovação",
  EXPIRATION_RENEWED: "Concluiu renovação",
  EXPIRATION_RENEWAL_CREATED: "Criou vencimento renovado",
  EXPIRATION_CANCELLED: "Cancelou vencimento",
  EXPIRATION_STATUS_CHANGED: "Alterou situação",
  EXPIRATION_DELETED: "Excluiu vencimento",
  PROFILE_CREATED: "Criou usuário",
  PROFILE_UPDATED: "Editou usuário",
  PROFILE_LEVEL_CHANGED: "Alterou nível",
  PROFILE_MANAGER_CHANGED: "Alterou hierarquia",
  PROFILE_ACTIVATED: "Ativou usuário",
  PROFILE_DEACTIVATED: "Desativou usuário",
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  legal_expirations: "Vencimento",
  legal_profiles: "Usuário",
};

export type AuditTone = "create" | "update" | "renewal" | "danger";

export function auditTone(action: string): AuditTone {
  if (/DELETED|CANCELLED|DEACTIVATED/.test(action)) return "danger";
  if (/RENEW|QUOTE/.test(action)) return "renewal";
  if (/CREATED|ACTIVATED/.test(action)) return "create";
  return "update";
}

/** Campos técnicos que mudam a cada gravação e só poluem o diff. */
const NOISE = new Set(["updated_at", "updated_by"]);

export type FieldChange = { field: string; before: unknown; after: unknown };

/**
 * Campos que mudaram entre old_data e new_data. Na criação (sem old_data),
 * lista os campos preenchidos do novo registro.
 */
export function auditChanges(
  oldData: unknown,
  newData: unknown,
): FieldChange[] {
  const before = isRecord(oldData) ? oldData : {};
  const after = isRecord(newData) ? newData : {};
  const creating = !isRecord(oldData);
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((field) => !NOISE.has(field))
    .sort();
  return fields
    .filter((field) =>
      creating
        ? after[field] !== null &&
          after[field] !== undefined &&
          after[field] !== ""
        : JSON.stringify(before[field]) !== JSON.stringify(after[field]),
    )
    .map((field) => ({ field, before: before[field], after: after[field] }));
}

/** Nome legível do registro afetado (documento ou pessoa). */
export function auditRecordLabel(
  entityType: string,
  oldData: unknown,
  newData: unknown,
): string | null {
  const data = isRecord(newData) ? newData : isRecord(oldData) ? oldData : null;
  if (!data) return null;
  const value =
    entityType === "legal_expirations" ? data.document_name : data.name;
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
