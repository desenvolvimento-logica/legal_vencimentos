import { parseAcessoriasDateTime } from "@/lib/acessorias/dates";
import { addCivilDays } from "@/lib/dates";
import type { ExpirationStatus } from "@/lib/expirations/display-status";

/** Indicadores de vencimentos do Dashboard que abrem a lista em popup. */
export const EXPIRATION_METRICS = [
  "overdue",
  "next7",
  "next15",
  "next30",
  "quoteSent",
  "renewing",
  "renewedThisMonth",
] as const;

export type ExpirationMetric = (typeof EXPIRATION_METRICS)[number];

export const METRIC_LABELS: Record<ExpirationMetric, string> = {
  overdue: "Vencidos",
  next7: "Próximos 7 dias",
  next15: "Próximos 15 dias",
  next30: "Próximos 30 dias",
  quoteSent: "Orçamentos enviados",
  renewing: "Em renovação",
  renewedThisMonth: "Renovados no mês",
};

/** Lista equivalente na tela Vencimentos (link secundário do popup). */
export const METRIC_LIST_HREF: Record<ExpirationMetric, string> = {
  overdue: "/expirations?situacao=vencidos",
  next7: "/expirations?periodo=7",
  next15: "/expirations?periodo=15",
  next30: "/expirations?periodo=30",
  quoteSent: "/expirations?situacao=orcamento-enviado",
  renewing: "/expirations?situacao=em-renovacao",
  renewedThisMonth: "/expirations?situacao=renovados",
};

const CURRENT: ExpirationStatus[] = ["ACTIVE", "QUOTE_SENT", "RENEWING"];

/** Subconjunto dos filtros do PostgREST usado pelas regras abaixo. */
type Filterable<Q> = {
  eq(column: string, value: string): Q;
  in(column: string, values: readonly string[]): Q;
  lt(column: string, value: string): Q;
  gte(column: string, value: string): Q;
  lte(column: string, value: string): Q;
};

/** Início do mês corrente em Brasília, como instante UTC (ISO). */
export function businessMonthStart(today: string): string {
  const [year, month] = today.split("-");
  return parseAcessoriasDateTime(`01/${month}/${year} 00:00:00`)!;
}

/**
 * Regra única de cada indicador, usada tanto na contagem quanto na lista do
 * popup, para que o número do card e os itens exibidos nunca divirjam.
 * `renewedThisMonth` filtra renewed_at e por isso usa legal_expirations; os
 * demais usam a view legal_expiration_list.
 */
export function applyMetricFilter<Q extends Filterable<Q>>(
  query: Q,
  metric: ExpirationMetric,
  today: string,
): Q {
  switch (metric) {
    case "overdue":
      return query.eq("status", "ACTIVE").lt("expiration_date", today);
    case "next7":
    case "next15":
    case "next30":
      return query
        .in("status", CURRENT)
        .gte("expiration_date", today)
        .lte(
          "expiration_date",
          addCivilDays(today, Number(metric.replace("next", ""))),
        );
    case "quoteSent":
      return query.eq("status", "QUOTE_SENT");
    case "renewing":
      return query.eq("status", "RENEWING");
    case "renewedThisMonth":
      return query
        .eq("status", "RENEWED")
        .gte("renewed_at", businessMonthStart(today));
  }
}
