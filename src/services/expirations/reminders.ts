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
};

/** O popup mostra até este número de lembretes, os mais próximos primeiro. */
export const REMINDERS_LIMIT = 50;

/**
 * Lembretes do responsável: vencimentos vigentes dele cujo lembrete já
 * começou (reminder_date <= hoje, legal_020), inclusive os já vencidos.
 * RLS limita ao escopo e exclui registros excluídos.
 */
export async function listMyReminders(
  profileId: string,
  today: string,
): Promise<ReminderItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("legal_expirations")
    .select(
      "id, client_id, document_name, expiration_type, expiration_date, status, reminder_days",
    )
    .eq("responsible_user_id", profileId)
    .in("status", ["ACTIVE", "RENEWING"])
    .not("reminder_date", "is", null)
    .lte("reminder_date", today)
    .order("expiration_date", { ascending: true })
    .limit(REMINDERS_LIMIT);
  if (error) throw new Error("Não foi possível carregar os lembretes.");
  if (data.length === 0) return [];

  const clientIds = [...new Set(data.map((row) => row.client_id))];
  const { data: clients, error: clientsError } = await supabase
    .from("legal_clients")
    .select("id, corporate_name")
    .in("id", clientIds);
  if (clientsError) throw new Error("Não foi possível carregar os lembretes.");
  const names = new Map(clients.map((row) => [row.id, row.corporate_name]));

  return data.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    clientName: names.get(row.client_id) ?? "—",
    documentName: row.document_name,
    type: row.expiration_type,
    expirationDate: row.expiration_date,
    status: row.status,
    reminderDays: row.reminder_days ?? 0,
  }));
}
