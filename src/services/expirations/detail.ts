"use server";

import { connection } from "next/server";

import { getSessionState } from "@/lib/auth/session";
import { toBusinessCivilDate } from "@/lib/dates";

import {
  getExpirationWithChain,
  type ExpirationWithChain,
} from "./get-expiration";

export type ExpirationDetailResult =
  | { ok: true; detail: ExpirationWithChain; today: string }
  | { ok: false; error: string };

/**
 * Detalhe do vencimento para o popup da tela Vencimentos: registro, cadeia de
 * renovações e sucessor. Escopo pelo RLS; inexistente e fora do escopo dão a
 * mesma resposta.
 */
export async function getExpirationDetail(
  expirationId: unknown,
): Promise<ExpirationDetailResult> {
  if (typeof expirationId !== "string")
    return { ok: false, error: "Vencimento inválido." };
  const session = await getSessionState();
  if (session.status !== "active")
    return { ok: false, error: "Sua sessão expirou. Entre novamente." };

  try {
    const detail = await getExpirationWithChain(expirationId);
    if (!detail) return { ok: false, error: "Vencimento não encontrado." };
    await connection();
    return { ok: true, detail, today: toBusinessCivilDate(new Date()) };
  } catch {
    return { ok: false, error: "Não foi possível carregar o vencimento." };
  }
}
