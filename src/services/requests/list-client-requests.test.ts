import { describe, expect, it } from "vitest";

import { requestFiltersSchema } from "./list-client-requests";

describe("requestFiltersSchema", () => {
  it("padrões seguros", () => {
    expect(requestFiltersSchema.parse({})).toMatchObject({ pagina: 1 });
  });

  it("aceita só ID numérico de solicitação e períodos permitidos", () => {
    expect(
      requestFiltersSchema.parse({ sol: "123abc", periodo: "45", pagina: "0" }),
    ).toMatchObject({ sol: undefined, periodo: undefined, pagina: 1 });
    expect(
      requestFiltersSchema.parse({
        sol: "987654",
        periodo: "90",
        status: " Nova ",
      }),
    ).toMatchObject({ sol: "987654", periodo: 90, status: "Nova" });
  });
});
