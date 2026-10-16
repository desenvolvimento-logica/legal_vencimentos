import { connection } from "next/server";

import { requireProfile } from "@/lib/auth/session";
import { toBusinessCivilDate } from "@/lib/dates";
import {
  listMyReminders,
  REMINDERS_LIMIT,
} from "@/services/expirations/reminders";

import { RemindersDialog } from "./reminders-dialog";

/**
 * Carregado uma vez pelo layout autenticado (o layout persiste entre
 * navegações). Falha ao carregar não bloqueia o app: o popup só não aparece.
 */
export async function Reminders() {
  const profile = await requireProfile();
  await connection();
  const today = toBusinessCivilDate(new Date());
  const items = await listMyReminders(profile.id, today).catch(() => []);
  if (items.length === 0) return null;
  return (
    <RemindersDialog
      items={items}
      today={today}
      truncated={items.length >= REMINDERS_LIMIT}
    />
  );
}
