import { describe, expect, it } from "vitest";

import { cancelExpirationSchema, createExpirationSchema } from "./expiration";

const valid = {
  clientId: "20000000-0000-4000-8000-00000000000a",
  expirationType: "LICENCA",
  documentName: "  Alvará de Funcionamento ",
  documentNumber: "",
  issuer: " Prefeitura ",
  issueDate: "",
  expirationDate: "2026-12-31",
  responsibleUserId: "",
  notes: "",
};

describe("createExpirationSchema", () => {
  it("normaliza campos opcionais vazios para null", () => {
    expect(createExpirationSchema.parse(valid)).toEqual({
      clientId: valid.clientId,
      expirationType: "LICENCA",
      documentName: "Alvará de Funcionamento",
      documentNumber: null,
      issuer: "Prefeitura",
      issueDate: null,
      expirationDate: "2026-12-31",
      responsibleUserId: null,
      notes: null,
    });
  });

  it.each([
    ["documentName", "   ", "Informe o documento."],
    ["expirationDate", "", "Informe uma data válida."],
    ["expirationDate", "2026-02-30", "Informe uma data válida."],
    ["issueDate", "31/12/2026", "Informe uma data válida."],
    ["expirationType", "OUTRO", "Selecione o tipo."],
    ["notes", "x".repeat(501), "Use no máximo 500 caracteres."],
  ])("rejeita %s = %j", (field, value, message) => {
    const result = createExpirationSchema.safeParse({
      ...valid,
      [field]: value,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      message,
    );
  });

  it("aceita 29/02 em ano bissexto", () => {
    expect(
      createExpirationSchema.safeParse({
        ...valid,
        expirationDate: "2028-02-29",
      }).success,
    ).toBe(true);
  });
});

describe("cancelExpirationSchema", () => {
  it("exige motivo", () => {
    const result = cancelExpirationSchema.safeParse({
      expirationId: valid.clientId,
      reason: "  ",
    });
    expect(result.success).toBe(false);
  });
});
