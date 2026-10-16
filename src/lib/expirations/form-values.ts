import type { ExpirationFieldsInput } from "@/lib/validators/expiration";
import type { Enums } from "@/types/database";

import type { RenewalPeriod } from "./period";

type ExpirationFields = {
  type: Enums<"legal_expiration_type">;
  documentName: string;
  documentNumber: string | null;
  issuer: string | null;
  issueDate: string | null;
  expirationDate: string;
  responsibleUserId: string | null;
  notes: string | null;
  renewalPeriod: RenewalPeriod | null;
  reminderDays: number | null;
};

/** Valores atuais de um vencimento no formato do formulário de edição. */
export function toExpirationFormValues(
  item: ExpirationFields,
): ExpirationFieldsInput {
  return {
    expirationType: item.type,
    documentName: item.documentName,
    documentNumber: item.documentNumber ?? "",
    issuer: item.issuer ?? "",
    issueDate: item.issueDate ?? "",
    expirationDate: item.expirationDate,
    responsibleUserId: item.responsibleUserId ?? "",
    notes: item.notes ?? "",
    renewalPeriod: item.renewalPeriod ?? "",
    reminderDays: item.reminderDays === null ? "" : String(item.reminderDays),
  };
}
