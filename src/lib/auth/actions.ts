"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LOGIN_PATH } from "@/lib/auth/paths";
import { REMINDERS_DISMISSED_COOKIE } from "@/lib/reminders/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  // O próximo login mostra os lembretes de novo.
  (await cookies()).delete(REMINDERS_DISMISSED_COOKIE);
  redirect(LOGIN_PATH);
}
