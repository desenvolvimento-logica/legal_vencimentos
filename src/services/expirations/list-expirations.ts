import "server-only";

import { z } from "zod";

import { addCivilDays } from "@/lib/dates";
import type { ExpirationStatus } from "@/lib/expirations/display-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export const EXPIRATION_SORT_COLUMNS = {
  cliente: "client_name",
  documento: "document_name",
  tipo: "expiration_type",
  vencimento: "expiration_date",
  situacao: "status",
} as const;

export type ExpirationSortKey = keyof typeof EXPIRATION_SORT_COLUMNS;

export const SITUATIONS = {
  vigentes: "Vigentes",
  vencidos: "Vencidos",
  "a-vencer": "A vencer",
  "orcamento-enviado": "Orçamento enviado",
  "em-renovacao": "Em renovação",
  renovados: "Renovados",
  cancelados: "Cancelados",
  todos: "Todos",
} as const;

export type SituationKey = keyof typeof SITUATIONS;

export const PERIODS = [7, 15, 30, 60] as const;
export const PAGE_SIZES = [10, 20, 50] as const;

const optionalText = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((value) => value || undefined);

const optionalCivilDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

export const expirationListParamsSchema = z.object({
  q: optionalText,
  tipo: z
    .enum(["CERTIDAO", "LICENCA", "CERTIFICADO"])
    .optional()
    .catch(undefined),
  situacao: z
    .enum(Object.keys(SITUATIONS) as [SituationKey, ...SituationKey[]])
    .catch("vigentes"),
  periodo: z.coerce
    .number()
    .refine((value) => (PERIODS as readonly number[]).includes(value))
    .optional()
    .catch(undefined),
  de: optionalCivilDate,
  ate: optionalCivilDate,
  pagina: z.coerce.number().int().min(1).catch(1),
  porPagina: z.coerce
    .number()
    .refine((value) => (PAGE_SIZES as readonly number[]).includes(value))
    .catch(20),
  ordem: z
    .enum(
      Object.keys(EXPIRATION_SORT_COLUMNS) as [
        ExpirationSortKey,
        ...ExpirationSortKey[],
      ],
    )
    .catch("vencimento"),
  direcao: z.enum(["asc", "desc"]).catch("asc"),
});

export type ExpirationListParams = z.infer<typeof expirationListParamsSchema>;

export type ExpirationListItem = {
  id: string;
  clientId: string;
  clientName: string;
  clientDocument: string | null;
  type: Enums<"legal_expiration_type">;
  documentName: string;
  documentNumber: string | null;
  issuer: string | null;
  issueDate: string | null;
  expirationDate: string;
  status: ExpirationStatus;
  responsibleUserId: string | null;
  notes: string | null;
  renewalPeriod: Enums<"legal_renewal_period"> | null;
  reminderDays: number | null;
};

const CURRENT: ExpirationStatus[] = ["ACTIVE", "QUOTE_SENT", "RENEWING"];

/**
 * Vencimentos visíveis ao usuário (view com security_invoker). `today` é a
 * data civil de negócio, usada nas situações calculadas e nos períodos.
 */
export async function listExpirations(
  params: ExpirationListParams,
  today: string,
): Promise<{ items: ExpirationListItem[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const from = (params.pagina - 1) * params.porPagina;

  let query = supabase
    .from("legal_expiration_list")
    .select(
      "id, client_id, client_name, client_document_number, expiration_type, document_name, document_number, issuer, issue_date, expiration_date, status, responsible_user_id, notes",
      { count: "exact" },
    );

  if (params.q) {
    const term = params.q
      .toLowerCase()
      .replace(/[\\%_]/g, (char) => `\\${char}`);
    query = query.ilike("search_text", `%${term}%`);
  }
  if (params.tipo) query = query.eq("expiration_type", params.tipo);

  if (params.periodo) {
    // Atalho "próximos N dias": vigentes entre hoje e hoje + N (inclusivo).
    query = query
      .in("status", CURRENT)
      .gte("expiration_date", today)
      .lte("expiration_date", addCivilDays(today, params.periodo));
  } else {
    switch (params.situacao) {
      case "vigentes":
        query = query.in("status", CURRENT);
        break;
      case "vencidos":
        query = query.eq("status", "ACTIVE").lt("expiration_date", today);
        break;
      case "a-vencer":
        query = query.eq("status", "ACTIVE").gte("expiration_date", today);
        break;
      case "orcamento-enviado":
        query = query.eq("status", "QUOTE_SENT");
        break;
      case "em-renovacao":
        query = query.eq("status", "RENEWING");
        break;
      case "renovados":
        query = query.eq("status", "RENEWED");
        break;
      case "cancelados":
        query = query.eq("status", "CANCELLED");
        break;
      case "todos":
        break;
    }
  }

  if (params.de) query = query.gte("expiration_date", params.de);
  if (params.ate) query = query.lte("expiration_date", params.ate);

  const { data, count, error } = await query
    .order(EXPIRATION_SORT_COLUMNS[params.ordem], {
      ascending: params.direcao === "asc",
      nullsFirst: false,
    })
    .order("expiration_date", { ascending: true })
    .order("id", { ascending: true })
    .range(from, from + params.porPagina - 1);

  if (error) throw new Error("Não foi possível carregar os vencimentos.");

  // Campos de legal_020 vêm da tabela: a view de legal_017 não muda (ver a
  // migration). Só os ids da página, com o mesmo RLS.
  const ids = data.map((row) => row.id!);
  const extras = new Map<
    string,
    {
      renewal_period: Enums<"legal_renewal_period"> | null;
      reminder_days: number | null;
    }
  >();
  if (ids.length > 0) {
    const { data: rows, error: extrasError } = await supabase
      .from("legal_expirations")
      .select("id, renewal_period, reminder_days")
      .in("id", ids);
    if (extrasError)
      throw new Error("Não foi possível carregar os vencimentos.");
    for (const row of rows) extras.set(row.id, row);
  }

  return {
    total: count ?? 0,
    items: data.map((row) => ({
      id: row.id!,
      clientId: row.client_id!,
      clientName: row.client_name!,
      clientDocument: row.client_document_number,
      type: row.expiration_type!,
      documentName: row.document_name!,
      documentNumber: row.document_number,
      issuer: row.issuer,
      issueDate: row.issue_date,
      expirationDate: row.expiration_date!,
      status: row.status!,
      responsibleUserId: row.responsible_user_id,
      notes: row.notes,
      renewalPeriod: extras.get(row.id!)?.renewal_period ?? null,
      reminderDays: extras.get(row.id!)?.reminder_days ?? null,
    })),
  };
}
