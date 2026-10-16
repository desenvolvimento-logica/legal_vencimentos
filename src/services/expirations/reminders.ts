import "server-only";

import type { ExpirationStatus } from "@/lib/expirations/display-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export type ReminderItem = {
  id: string;
  clientId: string;
  clientName: string;
  documentName: string;
  type: Enums<"legal_expiration_type">;
  expirationDate: string;
  status: ExpirationStatus;
  reminderDays: number;
  responsibleName: string | null;
};

/** O popup mostra até este número de lembretes, os mais próximos primeiro. */
export const REMINDERS_LIMIT = 50;

/**
 * Quem vê os lembretes (decisão de 16/10/2026): o USER vê os dele (é o
 * responsável); liderança, coordenação, gerência, diretoria e ADMIN veem
 * todos os do seu escopo. O escopo vem do RLS, não deste filtro.
 */
export function remindersAudience(
  level: Enums<"legal_hierarchy_level">,
): "own" | "scope" {
  return level === "USER" ? "own" : "scope";
}

/**
 * Vencimentos vigentes cujo lembrete já começou (reminder_date <= hoje,
 * legal_020), inclusive os já vencidos. Com `responsibleId`, só os desse
 * responsável. RLS limita ao escopo e exclui registros excluídos.
 */
export async function listReminders(
  responsibleId: string | null,
  today: string,
): Promise<ReminderItem[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("legal_expirations")
    .select(
      "id, client_id, document_name, expiration_type, expiration_date, status, reminder_days, responsible_user_id",
    )
    .in("status", ["ACTIVE", "RENEWING"])
    .not("reminder_date", "is", null)
    .lte("reminder_date", today);
  if (responsibleId) query = query.eq("responsible_user_id", responsibleId);

  const { data, error } = await query
    .order("expiration_date", { ascending: true })
    .limit(REMINDERS_LIMIT);
  if (error) throw new Error("Não foi possível carregar os lembretes.");
  if (data.length === 0) return [];

  const clientIds = [...new Set(data.map((row) => row.client_id))];
  const [clientsResult, profilesResult] = await Promise.all([
    supabase
      .from("legal_clients")
      .select("id, corporate_name")
      .in("id", clientIds),
    supabase.rpc("legal_visible_profiles"),
  ]);
  if (clientsResult.error || profilesResult.error)
    throw new Error("Não foi possível carregar os lembretes.");
  const clientNames = new Map(
    clientsResult.data.map((row) => [row.id, row.corporate_name]),
  );
  const profileNames = new Map(
    profilesResult.data.map((row) => [row.id, row.name]),
  );

  return data.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    clientName: clientNames.get(row.client_id) ?? "—",
    documentName: row.document_name,
    type: row.expiration_type,
    expirationDate: row.expiration_date,
    status: row.status,
    reminderDays: row.reminder_days ?? 0,
    responsibleName: row.responsible_user_id
      ? (profileNames.get(row.responsible_user_id) ?? null)
      : null,
  }));
}
