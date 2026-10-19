import { describe, expect, it } from "vitest";

import { expirationListParamsSchema } from "./list-expirations";

describe("expirationListParamsSchema", () => {
  it("padrões: vigentes, por vencimento crescente", () => {
    expect(expirationListParamsSchema.parse({})).toMatchObject({
      situacao: "vigentes",
      ordem: "vencimento",
      direcao: "asc",
      pagina: 1,
      porPagina: 20,
    });
    expect(expirationListParamsSchema.parse({}).periodo).toBeUndefined();
  });

  it("descarta valores fora das listas permitidas", () => {
    expect(
      expirationListParamsSchema.parse({
        tipo: "OUTRO",
        situacao: "qualquer",
        periodo: "45",
        de: "15/10/2026",
        ordem: "status; drop",
      }),
    ).toMatchObject({
      tipo: undefined,
      situacao: "vigentes",
      periodo: undefined,
      de: undefined,
      ordem: "vencimento",
    });
  });

  it("atalho CETESB: 180 dias só com o órgão fixo", () => {
    expect(
      expirationListParamsSchema.parse({ periodo: "180", orgao: "cetesb" }),
    ).toMatchObject({ periodo: 180, orgao: "cetesb" });
    expect(
      expirationListParamsSchema.parse({ orgao: "ibama" }).orgao,
    ).toBeUndefined();
  });

  it("aceita atalhos e filtros válidos", () => {
    expect(
      expirationListParamsSchema.parse({
        q: " alvará ",
        tipo: "LICENCA",
        periodo: "15",
        de: "2026-10-01",
        ate: "2026-12-31",
      }),
    ).toMatchObject({
      q: "alvará",
      tipo: "LICENCA",
      periodo: 15,
      de: "2026-10-01",
      ate: "2026-12-31",
    });
  });
});
