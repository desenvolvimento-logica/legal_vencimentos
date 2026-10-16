import { NextResponse, type NextRequest } from "next/server";

import { getSessionState } from "@/lib/auth/session";
import {
  isAllowedAttachmentUrl,
  safeFileName,
} from "@/lib/acessorias/request-detail";
import { findAttachment } from "@/services/requests/get-request-detail";

/** Limite de tamanho repassado (anexos de solicitações são documentos). */
const MAX_BYTES = 50 * 1024 * 1024;

// Download de anexo de solicitação pelo servidor do app (decisão de 16/10/2026):
// exige perfil ativo, confirma pelo RLS que a solicitação é visível e só busca
// em https://app.acessorias.com. A URL original nunca é enviada ao navegador.
export async function GET(
  _request: NextRequest,
  { params }: RouteContext<"/api/requests/[solId]/attachments/[key]">,
) {
  const session = await getSessionState();
  if (session.status !== "active") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { solId, key } = await params;
  const attachment = await findAttachment(solId, key).catch(() => null);
  if (!attachment || !isAllowedAttachmentUrl(attachment.url)) {
    return NextResponse.json(
      { error: "Anexo não encontrado." },
      { status: 404 },
    );
  }

  const upstream = await fetch(attachment.url, {
    // Não seguir redirecionamentos para fora do host validado.
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!upstream?.ok || !upstream.body) {
    return NextResponse.json(
      { error: "Não foi possível obter o anexo no Acessórias." },
      { status: 502 },
    );
  }

  // fetch descomprime gzip/br, mas mantém o content-length original: só o
  // repassa quando o corpo não veio comprimido.
  const compressed = Boolean(upstream.headers.get("content-encoding"));
  const length = compressed
    ? 0
    : Number(upstream.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) {
    return NextResponse.json(
      { error: "Anexo grande demais." },
      { status: 413 },
    );
  }

  const fileName = safeFileName(attachment.name);
  const asciiName = fileName.normalize("NFD").replace(/[^\x20-\x7e]/g, "_");

  return new Response(upstream.body.pipeThrough(limitBytes(MAX_BYTES)), {
    headers: {
      "Content-Type": "application/octet-stream",
      ...(length > 0 ? { "Content-Length": String(length) } : {}),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Interrompe o repasse se o corpo exceder o limite (mesmo sem Content-Length). */
function limitBytes(max: number): TransformStream<Uint8Array, Uint8Array> {
  let received = 0;
  return new TransformStream({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > max) {
        controller.error(new Error("Anexo grande demais."));
        return;
      }
      controller.enqueue(chunk);
    },
  });
}
