import { z } from "zod";

import { RENEWAL_PERIODS } from "@/lib/expirations/period";
import { EXPIRATION_TYPES } from "@/lib/labels";

/** Limites também aplicados no banco (legal_004/legal_016). */
export const EXPIRATION_LIMITS = {
  documentName: 200,
  documentNumber: 100,
  issuer: 200,
  notes: 2000,
  cancellationReason: 500,
  reminderDaysMax: 365,
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

const renewalPeriod = z
  .union([z.literal(""), z.enum(RENEWAL_PERIODS)], {
    error: "Selecione a periodicidade.",
  })
  .transform((value) => value || null);

/** Dias de antecedência do lembrete (vazio = sem lembrete). */
const reminderDays = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      (/^\d{1,3}$/.test(value) &&
        Number(value) >= 1 &&
        Number(value) <= EXPIRATION_LIMITS.reminderDaysMax),
    {
      error: `Informe de 1 a ${EXPIRATION_LIMITS.reminderDaysMax} dias.`,
    },
  )
  .transform((value) => (value === "" ? null : Number(value)));

/** Com periodicidade o vencimento é calculado da emissão (legal_020). */
function requireIssueDateWithPeriod(
  value: { renewalPeriod: unknown; issueDate: unknown },
  ctx: z.RefinementCtx,
) {
  if (value.renewalPeriod && !value.issueDate) {
    ctx.addIssue({
      code: "custom",
      path: ["issueDate"],
      message: "Informe a emissão para calcular o vencimento.",
    });
  }
}

const expirationFieldsShape = z.object({
  expirationType: z.enum(EXPIRATION_TYPES, {
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
  renewalPeriod,
  reminderDays,
});

/** Campos editáveis de um vencimento (formulário e servidor usam o mesmo schema). */
export const expirationFieldsSchema = expirationFieldsShape.superRefine(
  requireIssueDateWithPeriod,
);

export const createExpirationSchema = expirationFieldsShape
  .extend({ clientId: z.uuid() })
  .superRefine(requireIssueDateWithPeriod);

export const updateExpirationSchema = expirationFieldsShape
  .extend({ expirationId: z.uuid() })
  .superRefine(requireIssueDateWithPeriod);

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

/**
 * Novo período ao concluir a renovação (legal_complete_renewal). Com
 * periodicidade, o banco calcula o vencimento a partir da emissão (ou de
 * hoje, se vazia) e ignora a data enviada.
 */
export const completeRenewalSchema = z
  .object({
    expirationId: z.uuid(),
    expirationDate: z
      .union([z.literal(""), civilDate])
      .transform((value) => value || null),
    issueDate: z
      .union([z.literal(""), civilDate])
      .transform((value) => value || null),
    documentNumber: optionalText(EXPIRATION_LIMITS.documentNumber),
    issuer: optionalText(EXPIRATION_LIMITS.issuer),
    notes: optionalText(EXPIRATION_LIMITS.notes),
    renewalPeriod,
    reminderDays,
  })
  .superRefine((value, ctx) => {
    if (!value.renewalPeriod && !value.expirationDate) {
      ctx.addIssue({
        code: "custom",
        path: ["expirationDate"],
        message: "Informe a nova data de vencimento.",
      });
    }
  });

export type ExpirationFieldsInput = z.input<typeof expirationFieldsSchema>;
export type CompleteRenewalInput = z.input<typeof completeRenewalSchema>;
