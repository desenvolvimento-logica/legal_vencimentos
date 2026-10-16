import "server-only";

import { parseAcessoriasDateTime } from "@/lib/acessorias/dates";
import { addCivilDays } from "@/lib/dates";
import type { ExpirationStatus } from "@/lib/expirations/display-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export const UPCOMING_WINDOWS = [7, 15, 30] as const;
export type UpcomingWindow = (typeof UPCOMING_WINDOWS)[number];

export type DashboardMetrics = {
  clients: number;
  overdue: number;
  next7: number;
  next15: number;
  next30: number;
  renewing: number;
  renewedThisMonth: number;
};

export type UpcomingExpiration = {
  id: string;
  clientId: string;
  clientName: string;
  documentName: string;
  type: Enums<"legal_expiration_type">;
  expirationDate: string;
  status: ExpirationStatus;
  responsibleUserId: string | null;
};

export type TypeDistribution = {
  type: Enums<"legal_expiration_type">;
  count: number;
}[];

const CURRENT: ExpirationStatus[] = ["ACTIVE", "RENEWING"];

/**
 * Indicadores do Dashboard (SRS RF-11), sempre limitados ao escopo do
 * usuário: todas as consultas passam pelo RLS. `today` é a data civil de
 * negócio (America/Sao_Paulo).
 */
export async function getDashboard(today: string, window: UpcomingWindow) {
  const supabase = await createSupabaseServerClient();
  const list = () =>
    supabase
      .from("legal_expiration_list")
      .select("id", { count: "exact", head: true });

  // Início do mês corrente em Brasília, como instante UTC.
  const [year, month] = today.split("-");
  const monthStart = parseAcessoriasDateTime(`01/${month}/${year} 00:00:00`)!;

  const counts = await Promise.all([
    supabase.from("legal_clients").select("id", { count: "exact", head: true }),
    list().eq("status", "ACTIVE").lt("expiration_date", today),
    ...UPCOMING_WINDOWS.map((days) =>
      list()
        .in("status", CURRENT)
        .gte("expiration_date", today)
        .lte("expiration_date", addCivilDays(today, days)),
    ),
    list().eq("status", "RENEWING"),
    supabase
      .from("legal_expirations")
      .select("id", { count: "exact", head: true })
      .eq("status", "RENEWED")
      .gte("renewed_at", monthStart),
    ...(["CERTIDAO", "LICENCA", "CERTIFICADO"] as const).map((type) =>
      list().in("status", CURRENT).eq("expiration_type", type),
    ),
  ]);
  if (counts.some((result) => result.error)) {
    throw new Error("Não foi possível carregar os indicadores.");
  }
  const [clients, overdue, next7, next15, next30, renewing, renewed, ...types] =
    counts.map((result) => result.count ?? 0);

  // Próximos vencimentos: vigentes até hoje + N dias, incluindo os já vencidos.
  const { data: upcoming, error } = await supabase
    .from("legal_expiration_list")
    .select(
      "id, client_id, client_name, document_name, expiration_type, expiration_date, status, responsible_user_id",
    )
    .in("status", CURRENT)
    .lte("expiration_date", addCivilDays(today, window))
    .order("expiration_date", { ascending: true })
    .order("id")
    .limit(10);
  if (error)
    throw new Error("Não foi possível carregar os próximos vencimentos.");

  return {
    metrics: {
      clients,
      overdue,
      next7,
      next15,
      next30,
      renewing,
      renewedThisMonth: renewed,
    } satisfies DashboardMetrics,
    upcoming: upcoming.map((row): UpcomingExpiration => ({
      id: row.id!,
      clientId: row.client_id!,
      clientName: row.client_name!,
      documentName: row.document_name!,
      type: row.expiration_type!,
      expirationDate: row.expiration_date!,
      status: row.status!,
      responsibleUserId: row.responsible_user_id,
    })),
    distribution: [
      { type: "CERTIDAO", count: types[0] },
      { type: "LICENCA", count: types[1] },
      { type: "CERTIFICADO", count: types[2] },
    ] satisfies TypeDistribution,
  };
}
