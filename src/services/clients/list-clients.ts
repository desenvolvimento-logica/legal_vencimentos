import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Colunas ordenáveis: lista fechada, nunca o nome vindo da URL (DEVELOPMENT.md §7). */
export const CLIENT_SORT_COLUMNS = {
  razao: "corporate_name",
  fantasia: "trade_name",
  cnpj: "document_number",
  responsavel: "legalization_responsible_name",
  ativos: "active_expirations",
  proximo: "next_expiration_date",
  vencidos: "overdue_expirations",
} as const;

export type ClientSortKey = keyof typeof CLIENT_SORT_COLUMNS;

export const PAGE_SIZES = [10, 20, 50] as const;

const optionalText = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((value) => value || undefined);

export const clientListParamsSchema = z.object({
  razao: optionalText,
  fantasia: optionalText,
  cnpj: optionalText,
  pagina: z.coerce.number().int().min(1).catch(1),
  porPagina: z.coerce
    .number()
    .refine((value) => (PAGE_SIZES as readonly number[]).includes(value))
    .catch(20),
  ordem: z
    .enum(
      Object.keys(CLIENT_SORT_COLUMNS) as [ClientSortKey, ...ClientSortKey[]],
    )
    .catch("razao"),
  direcao: z.enum(["asc", "desc"]).catch("asc"),
});

export type ClientListParams = z.infer<typeof clientListParamsSchema>;

export type ClientListItem = {
  id: string;
  corporateName: string;
  tradeName: string | null;
  documentNumber: string | null;
  responsibleName: string | null;
  otherResponsibleName: string | null;
  activeExpirations: number;
  overdueExpirations: number;
  nextExpirationDate: string | null;
};

export type ClientListResult = {
  items: ClientListItem[];
  total: number;
  page: number;
  pageSize: number;
};

/** `%` e `_` digitados pelo usuário são literais, não curingas. */
function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * Carteira visível ao usuário atual. O escopo vem do RLS (view com
 * security_invoker); filtros, ordenação e paginação são feitos no banco.
 */
export async function listClients(
  params: ClientListParams,
): Promise<ClientListResult> {
  const supabase = await createSupabaseServerClient();
  const from = (params.pagina - 1) * params.porPagina;

  let query = supabase
    .from("legal_client_overview")
    .select(
      "id, corporate_name, trade_name, document_number, legalization_responsible_name, other_responsible_name, active_expirations, overdue_expirations, next_expiration_date",
      { count: "exact" },
    );

  if (params.razao)
    query = query.ilike("corporate_name", likePattern(params.razao));
  if (params.fantasia)
    query = query.ilike("trade_name", likePattern(params.fantasia));
  if (params.cnpj) {
    const digits = params.cnpj.replace(/\D/g, "");
    query = digits
      ? query.ilike("document_digits", likePattern(digits))
      : query.ilike("document_number", likePattern(params.cnpj));
  }

  const { data, count, error } = await query
    .order(CLIENT_SORT_COLUMNS[params.ordem], {
      ascending: params.direcao === "asc",
      nullsFirst: false,
    })
    .order("corporate_name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, from + params.porPagina - 1);

  if (error) {
    throw new Error("Não foi possível carregar os clientes.");
  }

  return {
    items: data.map((row) => ({
      id: row.id!,
      corporateName: row.corporate_name!,
      tradeName: row.trade_name,
      documentNumber: row.document_number,
      responsibleName: row.legalization_responsible_name,
      otherResponsibleName: row.other_responsible_name,
      activeExpirations: row.active_expirations ?? 0,
      overdueExpirations: row.overdue_expirations ?? 0,
      nextExpirationDate: row.next_expiration_date,
    })),
    total: count ?? 0,
    page: params.pagina,
    pageSize: params.porPagina,
  };
}
