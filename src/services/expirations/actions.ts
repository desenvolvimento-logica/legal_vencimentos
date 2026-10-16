"use server";

import { refresh } from "next/cache";
import type { z } from "zod";

import { getSessionState } from "@/lib/auth/session";
import { userMessageFromDbError } from "@/lib/db-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  cancelExpirationSchema,
  completeRenewalSchema,
  createExpirationSchema,
  updateExpirationSchema,
} from "@/lib/validators/expiration";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// Toda ação: valida a entrada no servidor, exige perfil ativo e grava com a
// sessão do usuário. Escopo, autoria, transições e responsável válido são
// garantidos pelo RLS e pelos triggers (legal_016).

async function authorizedClient() {
  const session = await getSessionState();
  if (session.status !== "active") return null;
  return createSupabaseServerClient();
}

const NO_SESSION: ActionResult = {
  ok: false,
  error: "Sua sessão expirou. Entre novamente.",
};

function invalid(error: z.ZodError): ActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    fieldErrors[field] ??= issue.message;
  }
  return { ok: false, error: "Revise os campos destacados.", fieldErrors };
}

export async function createExpiration(input: unknown): Promise<ActionResult> {
  const parsed = createExpirationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await authorizedClient();
  if (!supabase) return NO_SESSION;

  const value = parsed.data;
  const { data, error } = await supabase
    .from("legal_expirations")
    .insert({
      client_id: value.clientId,
      expiration_type: value.expirationType,
      document_name: value.documentName,
      document_number: value.documentNumber,
      issuer: value.issuer,
      issue_date: value.issueDate,
      expiration_date: value.expirationDate,
      responsible_user_id: value.responsibleUserId,
      notes: value.notes,
      // Sobrescritos pelo trigger a partir da sessão.
      created_by: "00000000-0000-0000-0000-000000000000",
      updated_by: "00000000-0000-0000-0000-000000000000",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: userMessageFromDbError(error) };
  refresh();
  return { ok: true, id: data.id };
}

export async function updateExpiration(input: unknown): Promise<ActionResult> {
  const parsed = updateExpirationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await authorizedClient();
  if (!supabase) return NO_SESSION;

  const value = parsed.data;
  const { data, error } = await supabase
    .from("legal_expirations")
    .update({
      expiration_type: value.expirationType,
      document_name: value.documentName,
      document_number: value.documentNumber,
      issuer: value.issuer,
      issue_date: value.issueDate,
      expiration_date: value.expirationDate,
      responsible_user_id: value.responsibleUserId,
      notes: value.notes,
    })
    .eq("id", value.expirationId)
    .select("id");

  if (error) return { ok: false, error: userMessageFromDbError(error) };
  if (data.length === 0)
    return { ok: false, error: "Vencimento não encontrado." };
  refresh();
  return { ok: true, id: value.expirationId };
}

async function setStatus(
  expirationId: string,
  from: "ACTIVE" | "RENEWING",
  to: "ACTIVE" | "RENEWING",
): Promise<ActionResult> {
  const supabase = await authorizedClient();
  if (!supabase) return NO_SESSION;
  const { data, error } = await supabase
    .from("legal_expirations")
    .update({ status: to })
    .eq("id", expirationId)
    .eq("status", from)
    .select("id");
  if (error) return { ok: false, error: userMessageFromDbError(error) };
  if (data.length === 0) {
    return {
      ok: false,
      error: "A situação do vencimento mudou. Atualize a tela.",
    };
  }
  refresh();
  return { ok: true, id: expirationId };
}

/** ACTIVE → RENEWING. */
export async function startRenewal(
  expirationId: string,
): Promise<ActionResult> {
  if (!isUuid(expirationId))
    return { ok: false, error: "Vencimento inválido." };
  return setStatus(expirationId, "ACTIVE", "RENEWING");
}

/** RENEWING → ACTIVE (desistência). */
export async function abandonRenewal(
  expirationId: string,
): Promise<ActionResult> {
  if (!isUuid(expirationId))
    return { ok: false, error: "Vencimento inválido." };
  return setStatus(expirationId, "RENEWING", "ACTIVE");
}

/** Conclui a renovação atomicamente: o anterior vira RENEWED e nasce o novo. */
export async function completeRenewal(input: unknown): Promise<ActionResult> {
  const parsed = completeRenewalSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await authorizedClient();
  if (!supabase) return NO_SESSION;

  const value = parsed.data;
  const { data, error } = await supabase.rpc("legal_complete_renewal", {
    old_id: value.expirationId,
    payload: {
      expiration_date: value.expirationDate,
      issue_date: value.issueDate ?? "",
      document_number: value.documentNumber ?? "",
      issuer: value.issuer ?? "",
      notes: value.notes ?? "",
    },
  });
  if (error) return { ok: false, error: userMessageFromDbError(error) };
  refresh();
  return { ok: true, id: data.id };
}

export async function cancelExpiration(input: unknown): Promise<ActionResult> {
  const parsed = cancelExpirationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await authorizedClient();
  if (!supabase) return NO_SESSION;

  const { data, error } = await supabase
    .from("legal_expirations")
    .update({ status: "CANCELLED", cancellation_reason: parsed.data.reason })
    .eq("id", parsed.data.expirationId)
    .in("status", ["ACTIVE", "RENEWING"])
    .select("id");
  if (error) return { ok: false, error: userMessageFromDbError(error) };
  if (data.length === 0) {
    return {
      ok: false,
      error: "A situação do vencimento mudou. Atualize a tela.",
    };
  }
  refresh();
  return { ok: true, id: parsed.data.expirationId };
}

export async function deleteExpiration(
  expirationId: string,
): Promise<ActionResult> {
  if (!isUuid(expirationId))
    return { ok: false, error: "Vencimento inválido." };
  const supabase = await authorizedClient();
  if (!supabase) return NO_SESSION;
  const { error } = await supabase.rpc("legal_delete_expiration", {
    expiration_id: expirationId,
  });
  if (error) return { ok: false, error: userMessageFromDbError(error) };
  refresh();
  return { ok: true };
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
