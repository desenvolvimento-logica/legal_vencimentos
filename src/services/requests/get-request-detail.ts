import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import { getServerEnv } from "@/config/env.server";
import { AcessoriasApiClient } from "@/lib/acessorias/client";
import { AcessoriasApiError } from "@/lib/acessorias/errors";
import {
  mapRequestDetail,
  type RequestDetail,
} from "@/lib/acessorias/request-detail";
import { acessoriasRequestDetailSchema } from "@/lib/acessorias/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Detalhe exibido no navegador: anexos identificados só por uma chave opaca. */
export type RequestDetailView = Omit<RequestDetail, "interactions"> & {
  interactions: (Omit<RequestDetail["interactions"][number], "attachments"> & {
    attachments: { key: string; name: string }[];
  })[];
};

const solIdSchema = z.string().regex(/^\d{1,12}$/);

/**
 * Chave opaca do anexo: hash da URL. A URL do Acessórias é pública (basta o
 * AnxKey para baixar), por isso nunca chega ao navegador.
 */
export function attachmentKey(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 24);
}

/**
 * Confirma pelo RLS que a solicitação pertence a um cliente visível ao
 * usuário. Sem isso, nenhuma chamada é feita ao Acessórias.
 */
async function isVisible(solId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("legal_acessorias_requests")
    .select("id")
    .eq("acessorias_request_id", solId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível verificar a solicitação.");
  return data !== null;
}

async function fetchDetail(solId: string): Promise<RequestDetail | null> {
  const env = getServerEnv();
  const api = new AcessoriasApiClient({
    baseUrl: env.ACESSORIAS_API_URL,
    token: env.ACESSORIAS_API_TOKEN,
    maxRetries: 2,
  });
  try {
    const [detail] = await api.get(
      `/requests/${solId}`,
      {},
      z.array(acessoriasRequestDetailSchema),
    );
    return detail ? mapRequestDetail(detail) : null;
  } catch (error) {
    if (error instanceof AcessoriasApiError && error.status === 404)
      return null;
    throw error;
  }
}

/** Detalhe da solicitação para a interface, ou null se não visível/inexistente. */
export async function getRequestDetail(
  solId: string,
): Promise<RequestDetailView | null> {
  if (!solIdSchema.safeParse(solId).success) return null;
  if (!(await isVisible(solId))) return null;

  const detail = await fetchDetail(solId);
  if (!detail) return null;

  return {
    ...detail,
    interactions: detail.interactions.map((interaction) => ({
      ...interaction,
      attachments: interaction.attachments.map((attachment) => ({
        key: attachmentKey(attachment.url),
        name: attachment.name,
      })),
    })),
  };
}

/** URL e nome do anexo pela chave, revalidando o acesso a cada download. */
export async function findAttachment(
  solId: string,
  key: string,
): Promise<{ url: string; name: string } | null> {
  if (!solIdSchema.safeParse(solId).success) return null;
  if (!/^[0-9a-f]{24}$/.test(key)) return null;
  if (!(await isVisible(solId))) return null;

  const detail = await fetchDetail(solId);
  const attachment = detail?.interactions
    .flatMap((interaction) => interaction.attachments)
    .find((item) => attachmentKey(item.url) === key);
  return attachment ?? null;
}
