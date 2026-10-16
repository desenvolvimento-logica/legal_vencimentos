import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { REQUEST_PERIODS } from "./list-client-requests";

export const REQUEST_SITUATIONS = {
  abertas: "Em aberto",
  atrasadas: "Atrasadas",
  concluidas: "Concluídas",
  todas: "Todas",
} as const;

export type RequestSituation = keyof typeof REQUEST_SITUATIONS;

export const REQUEST_SORTS = {
  atualizacao: { column: "last_update_at", ascending: false },
  prazo: { column: "due_at", ascending: true },
  abertura: { column: "opened_at", ascending: false },
} as const;

export const REQUEST_SORT_LABELS: Record<keyof typeof REQUEST_SORTS, string> = {
  atualizacao: "Última atualização",
  prazo: "Prazo mais próximo",
  abertura: "Abertura mais recente",
};

export const REQUEST_PAGE_SIZES = [20, 50] as const;

const optionalValue = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => value || undefined);

/** Parâmetros da tela Solicitações (todos vão na URL e são validados aqui). */
export const requestListParamsSchema = z.object({
  q: optionalValue,
  situacao: z
    .enum(
      Object.keys(REQUEST_SITUATIONS) as [
        RequestSituation,
        ...RequestSituation[],
      ],
    )
    .catch("abertas"),
  status: optionalValue,
  tipo: optionalValue,
  resp: optionalValue,
  periodo: z.coerce
    .number()
    .refine((value) => (REQUEST_PERIODS as readonly number[]).includes(value))
    .optional()
    .catch(undefined),
  ordem: z
    .enum(
      Object.keys(REQUEST_SORTS) as [
        keyof typeof REQUEST_SORTS,
        ...(keyof typeof REQUEST_SORTS)[],
      ],
    )
    .catch("atualizacao"),
  pagina: z.coerce.number().int().min(1).catch(1),
  porPagina: z.coerce
    .number()
    .refine((value) =>
      (REQUEST_PAGE_SIZES as readonly number[]).includes(value),
    )
    .catch(20),
  sol: z
    .string()
    .regex(/^\d{1,12}$/)
    .optional()
    .catch(undefined),
});

export type RequestListParams = z.infer<typeof requestListParamsSchema>;

export type RequestListItem = {
  id: string;
  acessoriasRequestId: string;
  clientId: string;
  clientName: string;
  clientDocument: string | null;
  subject: string | null;
  type: string | null;
  priority: string | null;
  status: string | null;
  officeResponsibles: string[];
  openedAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  /** Em aberto com prazo já passado. */
  overdue: boolean;
};

function toStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

/** Subconjunto dos filtros do PostgREST usado na situação. */
type Filterable<Q> = {
  is(column: string, value: null): Q;
  not(column: string, operator: string, value: null): Q;
  lt(column: string, value: string): Q;
};

/** "Em aberto" = sem data de conclusão no Acessórias; atrasada = prazo vencido. */
function applySituation<Q extends Filterable<Q>>(
  query: Q,
  situation: RequestSituation,
  now: string,
): Q {
  switch (situation) {
    case "abertas":
      return query.is("completed_at", null);
    case "atrasadas":
      return query.is("completed_at", null).lt("due_at", now);
    case "concluidas":
      return query.not("completed_at", "is", null);
    case "todas":
      return query;
  }
}

/**
 * Solicitações de todos os clientes visíveis ao usuário (view
 * legal_request_list, security_invoker: o escopo vem do RLS).
 */
export async function listRequests(params: RequestListParams): Promise<{
  items: RequestListItem[];
  total: number;
  counts: { abertas: number; atrasadas: number };
}> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const from = (params.pagina - 1) * params.porPagina;
  const sort = REQUEST_SORTS[params.ordem];

  let query = supabase
    .from("legal_request_list")
    .select(
      "id, acessorias_request_id, client_id, client_name, client_document_number, subject, request_type, priority, status, office_responsibles, opened_at, due_at, completed_at",
      { count: "exact" },
    );
  query = applySituation(query, params.situacao, now);
  if (params.q) {
    const term = params.q
      .toLowerCase()
      .replace(/[\\%_]/g, (char) => `\\${char}`);
    query = query.ilike("search_text", `%${term}%`);
  }
  if (params.status) query = query.eq("status", params.status);
  if (params.tipo) query = query.eq("request_type", params.tipo);
  if (params.resp) query = query.contains("office_responsibles", [params.resp]);
  if (params.periodo) {
    query = query.gte(
      "opened_at",
      new Date(Date.now() - params.periodo * 86_400_000).toISOString(),
    );
  }

  const count = (situation: RequestSituation) =>
    applySituation(
      supabase
        .from("legal_request_list")
        .select("id", { count: "exact", head: true }),
      situation,
      now,
    );

  const [list, open, overdue] = await Promise.all([
    query
      .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
      .order("id")
      .range(from, from + params.porPagina - 1),
    count("abertas"),
    count("atrasadas"),
  ]);
  if (list.error || open.error || overdue.error)
    throw new Error("Não foi possível carregar as solicitações.");

  return {
    total: list.count ?? 0,
    counts: { abertas: open.count ?? 0, atrasadas: overdue.count ?? 0 },
    items: list.data.map((row) => ({
      id: row.id!,
      acessoriasRequestId: row.acessorias_request_id!,
      clientId: row.client_id!,
      clientName: row.client_name!,
      clientDocument: row.client_document_number,
      subject: row.subject,
      type: row.request_type,
      priority: row.priority,
      status: row.status,
      officeResponsibles: toStrings(row.office_responsibles),
      openedAt: row.opened_at,
      dueAt: row.due_at,
      completedAt: row.completed_at,
      overdue:
        !row.completed_at &&
        row.due_at !== null &&
        Date.parse(row.due_at) < Date.parse(now),
    })),
  };
}

/** Limite de linhas lidas para montar as opções dos filtros. */
const OPTIONS_SAMPLE = 5000;

/** Valores existentes para os filtros (status, tipo e responsáveis) no escopo. */
export async function getRequestListFilterOptions() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("legal_request_list")
    .select("status, request_type, office_responsibles")
    .order("last_update_at", { ascending: false, nullsFirst: false })
    .limit(OPTIONS_SAMPLE);
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
