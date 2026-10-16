import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const REQUESTS_PAGE_SIZE = 20;
export const REQUEST_PERIODS = [30, 90] as const;

export type ClientRequest = {
  id: string;
  acessoriasRequestId: string;
  subject: string | null;
  type: string | null;
  priority: string | null;
  status: string | null;
  officeResponsibles: string[];
  openedAt: string | null;
  dueAt: string | null;
};

const optionalValue = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => value || undefined);

/** Filtros da aba Solicitações (docs/mockups/08-client-requests.png). */
export const requestFiltersSchema = z.object({
  status: optionalValue,
  tipo: optionalValue,
  resp: optionalValue,
  periodo: z.coerce
    .number()
    .refine((value) => (REQUEST_PERIODS as readonly number[]).includes(value))
    .optional()
    .catch(undefined),
  pagina: z.coerce.number().int().min(1).catch(1),
  sol: z
    .string()
    .regex(/^\d{1,12}$/)
    .optional()
    .catch(undefined),
});

export type RequestFilters = z.infer<typeof requestFiltersSchema>;

function toStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

/** Solicitações em cache (somente leitura) do cliente, mais recentes primeiro. */
export async function listClientRequests(
  acessoriasCompanyId: string,
  filters: RequestFilters,
): Promise<{ items: ClientRequest[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const from = (filters.pagina - 1) * REQUESTS_PAGE_SIZE;

  let query = supabase
    .from("legal_acessorias_requests")
    .select(
      "id, acessorias_request_id, subject, request_type, priority, status, office_responsibles, opened_at, due_at",
      { count: "exact" },
    )
    .eq("acessorias_company_id", acessoriasCompanyId);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.tipo) query = query.eq("request_type", filters.tipo);
  if (filters.resp)
    query = query.contains("office_responsibles", [filters.resp]);
  if (filters.periodo) {
    query = query.gte(
      "opened_at",
      new Date(Date.now() - filters.periodo * 86_400_000).toISOString(),
    );
  }

  const { data, count, error } = await query
    .order("last_update_at", { ascending: false, nullsFirst: false })
    .order("id")
    .range(from, from + REQUESTS_PAGE_SIZE - 1);
  if (error) throw new Error("Não foi possível carregar as solicitações.");

  return {
    total: count ?? 0,
    items: data.map((row) => ({
      id: row.id,
      acessoriasRequestId: row.acessorias_request_id,
      subject: row.subject,
      type: row.request_type,
      priority: row.priority,
      status: row.status,
      officeResponsibles: toStrings(row.office_responsibles),
      openedAt: row.opened_at,
      dueAt: row.due_at,
    })),
  };
}

/** Valores existentes para os filtros (status, tipo e responsáveis) do cliente. */
export async function getRequestFilterOptions(acessoriasCompanyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("legal_acessorias_requests")
    .select("status, request_type, office_responsibles")
    .eq("acessorias_company_id", acessoriasCompanyId)
    .limit(1000);
  if (error) throw new Error("Não foi possível carregar os filtros.");

  const sorted = (values: Iterable<string>) =>
    [...new Set(values)]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

  return {
    statuses: sorted(data.map((row) => row.status ?? "")),
    types: sorted(data.map((row) => row.request_type ?? "")),
    responsibles: sorted(
      data.flatMap((row) => toStrings(row.office_responsibles)),
    ),
  };
}
