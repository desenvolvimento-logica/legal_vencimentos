import { z } from "zod";

import type { AcessoriasApiClient, QueryValue } from "./client";

/** A API devolve 20 registros por página e uma lista vazia ao final. */
export const ACESSORIAS_PAGE_SIZE = 20;

export type PaginateOptions = {
  /** Proteção contra loop infinito (ACESSORIAS.md §5). */
  maxPages?: number;
  signal?: AbortSignal;
};

/**
 * Percorre as páginas de um endpoint `ListAll`, uma por vez, entregando cada
 * página ao consumidor. A próxima página só é pedida depois que o consumidor
 * processa a atual, sem acumular o conjunto inteiro em memória.
 */
export async function* paginateAcessorias<T>(
  client: AcessoriasApiClient,
  path: string,
  query: Record<string, QueryValue>,
  itemSchema: z.ZodType<T>,
  { maxPages = 20_000, signal }: PaginateOptions = {},
): AsyncGenerator<{ page: number; items: T[] }> {
  const pageSchema = z.array(itemSchema);
  let previousSignature: string | undefined;

  for (let page = 1; page <= maxPages; page++) {
    signal?.throwIfAborted();
    const items = await client.get(
      path,
      { ...query, Pagina: page },
      pageSchema,
    );
    if (items.length === 0) return;

    // Se a API ignorar o parâmetro de página, a mesma página voltaria para sempre.
    const signature = JSON.stringify(items[0]);
    if (signature === previousSignature) {
      throw new Error(
        `Paginação do Acessórias repetiu a página ${page - 1} em ${path}.`,
      );
    }
    previousSignature = signature;

    yield { page, items };

    if (items.length < ACESSORIAS_PAGE_SIZE) return;
  }

  throw new Error(
    `Paginação do Acessórias excedeu ${maxPages} páginas em ${path}.`,
  );
}
