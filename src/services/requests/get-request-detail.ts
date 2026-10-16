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

/**
 * Um cliente por instância do servidor: o limite de 90 req/min vale para
 * todas as requisições juntas, não para cada uma (cota do token é única).
 */
let sharedClient: AcessoriasApiClient | undefined;
function apiClient(): AcessoriasApiClient {
  const env = getServerEnv();
  sharedClient ??= new AcessoriasApiClient({
    baseUrl: env.ACESSORIAS_API_URL,
    token: env.ACESSORIAS_API_TOKEN,
    maxRetries: 2,
  });
  return sharedClient;
}

/**
 * Cache curto do detalhe por instância: abrir o painel e baixar anexos em
 * sequência não gera uma chamada ao Acessórias a cada clique. O acesso do
 * usuário é verificado antes de consultar o cache (isVisible).
 */
const DETAIL_TTL_MS = 60_000;
const MAX_CACHED = 200;
const detailCache = new Map<
  string,
  { expiresAt: number; detail: RequestDetail | null }
>();

async function fetchDetail(solId: string): Promise<RequestDetail | null> {
  const cached = detailCache.get(solId);
  if (cached && cached.expiresAt > Date.now()) return cached.detail;

  let detail: RequestDetail | null;
  try {
    const [raw] = await apiClient().get(
      `/requests/${solId}`,
      {},
      z.array(acessoriasRequestDetailSchema),
    );
    detail = raw ? mapRequestDetail(raw) : null;
  } catch (error) {
    if (!(error instanceof AcessoriasApiError && error.status === 404))
      throw error;
    detail = null;
  }

  if (detailCache.size >= MAX_CACHED) {
    // Remove a entrada mais antiga (Map mantém a ordem de inserção).
    detailCache.delete(detailCache.keys().next().value!);
  }
  detailCache.set(solId, { expiresAt: Date.now() + DETAIL_TTL_MS, detail });
  return detail;
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
