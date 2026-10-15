import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/config/env.server";
import { runAcessoriasSync, SYNC_ORDER } from "@/services/sync";

// Sincronização com o Acessórias. GET: Vercel Cron diário (incremental).
// POST: carga manual (`npm run sync`), com progresso em NDJSON.
// Ambos exigem "Authorization: Bearer <CRON_SECRET>".

// Limite da função no plano Hobby com Fluid Compute.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  const results = await runAcessoriasSync(SYNC_ORDER, "incremental");
  return NextResponse.json({ results });
}

const manualSyncSchema = z.object({
  types: z.array(z.enum(["companies", "users", "requests"])).min(1),
  mode: z.enum(["full", "incremental"]).default("incremental"),
});

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();

  const parsed = manualSyncSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Informe types (companies, users, requests) e mode (full, incremental).",
      },
      { status: 400 },
    );
  }
  const { types, mode } = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const results = await runAcessoriasSync(types, mode, (progress) =>
          send({ event: "progress", ...progress }),
        );
        send({ event: "done", results });
      } catch (error) {
        send({
          event: "error",
          message:
            error instanceof Error ? error.message : "Erro desconhecido.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isAuthorized(request: NextRequest): boolean {
  const expected = Buffer.from(`Bearer ${getServerEnv().CRON_SECRET}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

function unauthorized() {
  return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
}
