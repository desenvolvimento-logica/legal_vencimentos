import { connection } from "next/server";

import { requireProfile } from "@/lib/auth/session";
import { toBusinessCivilDate } from "@/lib/dates";
import {
  listReminders,
  REMINDERS_LIMIT,
  remindersAudience,
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
  const audience = remindersAudience(profile.hierarchyLevel);
  const items = await listReminders(
    audience === "own" ? profile.id : null,
    today,
  ).catch(() => []);
  if (items.length === 0) return null;
  return (
    <RemindersDialog
      items={items}
      today={today}
      audience={audience}
      truncated={items.length >= REMINDERS_LIMIT}
    />
  );
}
