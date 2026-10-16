"use server";

import { connection } from "next/server";
import { z } from "zod";

import { getSessionState } from "@/lib/auth/session";
import { toBusinessCivilDate } from "@/lib/dates";
import type { ExpirationStatus } from "@/lib/expirations/display-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

import { applyMetricFilter, EXPIRATION_METRICS } from "./metrics";

export type MetricItem = {
  id: string;
  clientId: string;
  clientName: string;
  documentName: string;
  type: Enums<"legal_expiration_type">;
  expirationDate: string;
  status: ExpirationStatus;
};

export type MetricItemsResult =
  | { ok: true; items: MetricItem[]; total: number; today: string }
  | { ok: false; error: string };

/** O popup mostra até este número de itens; o restante fica na tela Vencimentos. */
const POPUP_LIMIT = 50;

const metricSchema = z.enum(EXPIRATION_METRICS);

/**
 * Vencimentos de um card do Dashboard. Mesma regra da contagem (metrics.ts)
 * e mesmo escopo do usuário (RLS).
 */
export async function getMetricItems(
  input: unknown,
): Promise<MetricItemsResult> {
  const parsed = metricSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Indicador inválido." };
  const session = await getSessionState();
  if (session.status !== "active") {
    return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  }

  await connection();
  const today = toBusinessCivilDate(new Date());
  const supabase = await createSupabaseServerClient();
  const metric = parsed.data;

  if (metric === "renewedThisMonth") {
    // renewed_at só existe na tabela; o cliente vem pelo relacionamento.
    const { data, count, error } = await applyMetricFilter(
      supabase
        .from("legal_expirations")
        .select(
          "id, client_id, document_name, expiration_type, expiration_date, status, legal_clients(corporate_name)",
          { count: "exact" },
        ),
      metric,
      today,
    )
      .order("renewed_at", { ascending: false })
      .limit(POPUP_LIMIT);
    if (error)
      return { ok: false, error: "Não foi possível carregar os vencimentos." };
    return {
      ok: true,
      today,
      total: count ?? 0,
      items: data.map((row) => ({
        id: row.id,
        clientId: row.client_id,
        clientName: row.legal_clients?.corporate_name ?? "—",
        documentName: row.document_name,
        type: row.expiration_type,
        expirationDate: row.expiration_date,
        status: row.status,
      })),
    };
  }

  const { data, count, error } = await applyMetricFilter(
    supabase
      .from("legal_expiration_list")
      .select(
        "id, client_id, client_name, document_name, expiration_type, expiration_date, status",
        { count: "exact" },
      ),
    metric,
    today,
  )
    .order("expiration_date", { ascending: true })
    .order("id")
    .limit(POPUP_LIMIT);
  if (error)
    return { ok: false, error: "Não foi possível carregar os vencimentos." };

  return {
    ok: true,
    today,
    total: count ?? 0,
    items: data.map((row) => ({
      id: row.id!,
      clientId: row.client_id!,
      clientName: row.client_name!,
      documentName: row.document_name!,
      type: row.expiration_type!,
      expirationDate: row.expiration_date!,
      status: row.status!,
    })),
  };
}
