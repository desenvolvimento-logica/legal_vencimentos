import { describe, expect, it } from "vitest";

import { clientListParamsSchema } from "./list-clients";

describe("clientListParamsSchema", () => {
  it("aplica padrões seguros a parâmetros ausentes", () => {
    expect(clientListParamsSchema.parse({})).toEqual({
      razao: undefined,
      fantasia: undefined,
      cnpj: undefined,
      pagina: 1,
      porPagina: 20,
      ordem: "razao",
      direcao: "asc",
    });
  });

  it("ignora valores inválidos em vez de falhar", () => {
    expect(
      clientListParamsSchema.parse({
        pagina: "-3",
        porPagina: "1000",
        ordem: "corporate_name; drop table",
        direcao: "sideways",
      }),
    ).toMatchObject({
      pagina: 1,
      porPagina: 20,
      ordem: "razao",
      direcao: "asc",
    });
  });

  it("aceita filtros e ordenação válidos", () => {
    expect(
      clientListParamsSchema.parse({
        razao: "  Alfa  ",
        cnpj: "12.345",
        pagina: "3",
        porPagina: "50",
        ordem: "vencidos",
        direcao: "desc",
      }),
    ).toMatchObject({
      razao: "Alfa",
      cnpj: "12.345",
      pagina: 3,
      porPagina: 50,
      ordem: "vencidos",
      direcao: "desc",
    });
  });
});
