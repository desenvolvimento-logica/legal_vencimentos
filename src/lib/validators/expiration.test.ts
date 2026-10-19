import { describe, expect, it } from "vitest";

import {
  cancelExpirationSchema,
  completeRenewalSchema,
  createExpirationSchema,
} from "./expiration";

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
  renewalPeriod: "",
  reminderDays: "",
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
      renewalPeriod: null,
      reminderDays: null,
    });
  });

  it.each([
    ["documentName", "   ", "Informe o documento."],
    ["expirationDate", "", "Informe uma data válida."],
    ["expirationDate", "2026-02-30", "Informe uma data válida."],
    ["issueDate", "31/12/2026", "Informe uma data válida."],
    ["expirationType", "ALVARA", "Selecione o tipo."],
    ["notes", "x".repeat(2001), "Use no máximo 2000 caracteres."],
    ["renewalPeriod", "WEEKLY", "Selecione a periodicidade."],
    ["reminderDays", "0", "Informe de 1 a 365 dias."],
    ["reminderDays", "366", "Informe de 1 a 365 dias."],
    ["reminderDays", "1.5", "Informe de 1 a 365 dias."],
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

describe("periodicidade e lembrete", () => {
  it("converte o lembrete em número", () => {
    const result = createExpirationSchema.parse({
      ...valid,
      issueDate: "2026-01-10",
      renewalPeriod: "ANNUAL",
      reminderDays: " 30 ",
    });
    expect(result).toMatchObject({ renewalPeriod: "ANNUAL", reminderDays: 30 });
  });

  it("periodicidade exige emissão", () => {
    const result = createExpirationSchema.safeParse({
      ...valid,
      renewalPeriod: "MONTHLY",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["issueDate"],
      message: "Informe a emissão para calcular o vencimento.",
    });
  });
});

describe("completeRenewalSchema", () => {
  const renewal = {
    expirationId: valid.clientId,
    expirationDate: "",
    issueDate: "",
    documentNumber: "",
    issuer: "",
    notes: "",
    renewalPeriod: "",
    reminderDays: "",
  };

  it("sem periodicidade exige a nova data", () => {
    const result = completeRenewalSchema.safeParse(renewal);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["expirationDate"]);
  });

  it("com periodicidade a data é calculada pelo banco", () => {
    expect(
      completeRenewalSchema.safeParse({ ...renewal, renewalPeriod: "MONTHLY" })
        .success,
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
