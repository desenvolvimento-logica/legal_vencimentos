import { z } from "zod";

/** Limites também aplicados no banco (legal_004/legal_016). */
export const EXPIRATION_LIMITS = {
  documentName: 200,
  documentNumber: 100,
  issuer: 200,
  notes: 500,
  cancellationReason: 500,
} as const;

const civilDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Informe uma data válida." })
  .refine(
    (value) => {
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return (
        year >= 1900 &&
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    },
    { error: "Informe uma data válida." },
  );

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Use no máximo ${max} caracteres.` })
    .transform((value) => value || null);

/** Campos editáveis de um vencimento (formulário e servidor usam o mesmo schema). */
export const expirationFieldsSchema = z.object({
  expirationType: z.enum(["CERTIDAO", "LICENCA", "CERTIFICADO"], {
    error: "Selecione o tipo.",
  }),
  documentName: z
    .string()
    .trim()
    .min(1, { error: "Informe o documento." })
    .max(EXPIRATION_LIMITS.documentName, {
      error: `Use no máximo ${EXPIRATION_LIMITS.documentName} caracteres.`,
    }),
  documentNumber: optionalText(EXPIRATION_LIMITS.documentNumber),
  issuer: optionalText(EXPIRATION_LIMITS.issuer),
  issueDate: z
    .union([z.literal(""), civilDate])
    .transform((value) => value || null),
  expirationDate: civilDate,
  responsibleUserId: z
    .union([z.literal(""), z.uuid({ error: "Responsável inválido." })])
    .transform((value) => value || null),
  notes: optionalText(EXPIRATION_LIMITS.notes),
});

export const createExpirationSchema = expirationFieldsSchema.extend({
  clientId: z.uuid(),
});

export const updateExpirationSchema = expirationFieldsSchema.extend({
  expirationId: z.uuid(),
});

export const cancelExpirationSchema = z.object({
  expirationId: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(1, { error: "Informe o motivo do cancelamento." })
    .max(EXPIRATION_LIMITS.cancellationReason, {
      error: `Use no máximo ${EXPIRATION_LIMITS.cancellationReason} caracteres.`,
    }),
});

/** Novo período ao concluir a renovação (legal_complete_renewal). */
export const completeRenewalSchema = z.object({
  expirationId: z.uuid(),
  expirationDate: civilDate,
  issueDate: z
    .union([z.literal(""), civilDate])
    .transform((value) => value || null),
  documentNumber: optionalText(EXPIRATION_LIMITS.documentNumber),
  issuer: optionalText(EXPIRATION_LIMITS.issuer),
  notes: optionalText(EXPIRATION_LIMITS.notes),
});

export type ExpirationFieldsInput = z.input<typeof expirationFieldsSchema>;
export type CompleteRenewalInput = z.input<typeof completeRenewalSchema>;
