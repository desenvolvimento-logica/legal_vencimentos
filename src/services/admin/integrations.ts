"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { getServerEnv } from "@/config/env.server";
import { AcessoriasApiClient } from "@/lib/acessorias/client";
import { AcessoriasApiError } from "@/lib/acessorias/errors";
import { getSessionState } from "@/lib/auth/session";
import { runAcessoriasSync, SYNC_ORDER } from "@/services/sync";

export type ConnectionTestResult =
  | { ok: true; testedAt: string; latencyMs: number }
  | { ok: false; testedAt: string; error: string };

export type ManualSyncResult =
  | {
      ok: true;
      results: { type: string; status: string; errorMessage: string | null }[];
    }
  | { ok: false; error: string };

async function isAdmin(): Promise<boolean> {
  const session = await getSessionState();
  return session.status === "active" && session.profile.isAdmin;
}

/** Uma chamada de leitura leve (departamentos) para validar token e rede. */
export async function testAcessoriasConnection(): Promise<ConnectionTestResult> {
  const testedAt = new Date().toISOString();
  if (!(await isAdmin())) {
    return {
      ok: false,
      testedAt,
      error: "Você não tem permissão para esta operação.",
    };
  }
  const env = getServerEnv();
  const api = new AcessoriasApiClient({
    baseUrl: env.ACESSORIAS_API_URL,
    token: env.ACESSORIAS_API_TOKEN,
    maxRetries: 0,
    timeoutMs: 15_000,
  });
  const started = Date.now();
  try {
    await api.get("/departments/ListAll", {}, z.array(z.unknown()));
    return { ok: true, testedAt, latencyMs: Date.now() - started };
  } catch (error) {
    const message =
      error instanceof AcessoriasApiError
        ? error.status === 401
          ? "Token do Acessórias inválido ou expirado."
          : error.message
        : "Falha ao conectar ao Acessórias.";
    return { ok: false, testedAt, error: message };
  }
}

const typesSchema = z.array(z.enum(["companies", "users", "requests"])).min(1);

/**
 * Sincronização manual incremental (segundos). A carga completa continua
 * pelo `npm run sync`, que não cabe no limite de tempo de uma função.
 * Execuções paralelas do mesmo tipo são recusadas pelo banco (legal_012).
 */
export async function runManualSync(input: unknown): Promise<ManualSyncResult> {
  const parsed = typesSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Tipo de sincronização inválido." };
  if (!(await isAdmin())) {
    return { ok: false, error: "Você não tem permissão para esta operação." };
  }
  try {
    const outcomes = await runAcessoriasSync(
      SYNC_ORDER.filter((type) => parsed.data.includes(type)),
      "incremental",
    );
    refresh();
    return {
      ok: true,
      results: outcomes.map((outcome) => ({
        type: outcome.type,
        status: outcome.status,
        errorMessage: outcome.errorMessage,
      })),
    };
  } catch {
    return { ok: false, error: "A sincronização não pôde ser executada." };
  }
}
