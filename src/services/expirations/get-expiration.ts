import "server-only";

import { z } from "zod";

import type { ExpirationStatus } from "@/lib/expirations/display-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export type ExpirationRecord = {
  id: string;
  clientId: string;
  type: Enums<"legal_expiration_type">;
  documentName: string;
  documentNumber: string | null;
  issuer: string | null;
  issueDate: string | null;
  expirationDate: string;
  status: ExpirationStatus;
  previousExpirationId: string | null;
  renewalPeriod: Enums<"legal_renewal_period"> | null;
  reminderDays: number | null;
  responsibleUserId: string | null;
  notes: string | null;
  cancellationReason: string | null;
  renewedAt: string | null;
  quoteSentAt: string | null;
  createdAt: string;
};

export type ExpirationWithChain = {
  expiration: ExpirationRecord;
  client: { id: string; name: string };
  /** Do registro atual para os mais antigos (cadeia de renovações). */
  chain: ExpirationRecord[];
  /** Registro que substituiu este na renovação (só em RENEWED). */
  next: ExpirationRecord | null;
};

const SELECT =
  "id, client_id, expiration_type, document_name, document_number, issuer, issue_date, expiration_date, status, previous_expiration_id, renewal_period, reminder_days, responsible_user_id, notes, cancellation_reason, renewed_at, quote_sent_at, created_at";

/** Limite de segurança ao percorrer a cadeia (ela é acíclica por construção). */
const MAX_CHAIN = 50;

type Row = {
  id: string;
  client_id: string;
  expiration_type: Enums<"legal_expiration_type">;
  document_name: string;
  document_number: string | null;
  issuer: string | null;
  issue_date: string | null;
  expiration_date: string;
  status: ExpirationStatus;
  previous_expiration_id: string | null;
  renewal_period: Enums<"legal_renewal_period"> | null;
  reminder_days: number | null;
  responsible_user_id: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  renewed_at: string | null;
  quote_sent_at: string | null;
  created_at: string;
};

function toRecord(row: Row): ExpirationRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    type: row.expiration_type,
    documentName: row.document_name,
    documentNumber: row.document_number,
    issuer: row.issuer,
    issueDate: row.issue_date,
    expirationDate: row.expiration_date,
    status: row.status,
    previousExpirationId: row.previous_expiration_id,
    renewalPeriod: row.renewal_period,
    reminderDays: row.reminder_days,
    responsibleUserId: row.responsible_user_id,
    notes: row.notes,
    cancellationReason: row.cancellation_reason,
    renewedAt: row.renewed_at,
    quoteSentAt: row.quote_sent_at,
    createdAt: row.created_at,
  };
}

/**
 * Vencimento visível ao usuário, com o cliente e a cadeia de renovações.
 * Fora do escopo e inexistente são indistinguíveis (null).
 */
export async function getExpirationWithChain(
  id: string,
): Promise<ExpirationWithChain | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();

  const { data: current, error } = await supabase
    .from("legal_expirations")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar o vencimento.");
  if (!current) return null;

  const { data: client, error: clientError } = await supabase
    .from("legal_clients")
    .select("id, corporate_name")
    .eq("id", current.client_id)
    .maybeSingle();
  if (clientError) throw new Error("Não foi possível carregar o cliente.");
  if (!client) return null;

  const chain: ExpirationRecord[] = [toRecord(current)];
  let previousId = current.previous_expiration_id;
  while (previousId && chain.length < MAX_CHAIN) {
    const { data: previous, error: previousError } = await supabase
      .from("legal_expirations")
      .select(SELECT)
      .eq("id", previousId)
      .maybeSingle();
    if (previousError || !previous) break;
    chain.push(toRecord(previous));
    previousId = previous.previous_expiration_id;
  }

  let next: ExpirationRecord | null = null;
  if (current.status === "RENEWED") {
    const { data: successor } = await supabase
      .from("legal_expirations")
      .select(SELECT)
      .eq("previous_expiration_id", current.id)
      .maybeSingle();
    next = successor ? toRecord(successor) : null;
  }

  return {
    expiration: toRecord(current),
    client: { id: client.id, name: client.corporate_name },
    chain,
    next,
  };
}
