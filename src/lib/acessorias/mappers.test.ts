import { describe, expect, it } from "vitest";

import { companyFixture, requestFixture, userFixture } from "./fixtures";
import { mapCompany, mapRequest, mapUser } from "./mappers";
import {
  acessoriasCompanySchema,
  acessoriasRequestSchema,
  acessoriasUserSchema,
} from "./schemas";

const SYNCED_AT = "2026-10-15T18:00:00.000Z";
const DEPARTMENTS = { primaryId: "5", subdepartmentIds: ["13"] };

describe("mapCompany", () => {
  const mapped = mapCompany(
    acessoriasCompanySchema.parse(companyFixture),
    DEPARTMENTS,
    SYNCED_AT,
  );

  it("mapeia o cliente com o responsável principal (departamento 5)", () => {
    expect(mapped.client).toEqual({
      acessorias_company_id: "1234",
      document_number: "11.222.333/0001-81",
      corporate_name: "Empresa Exemplo Comércio Ltda",
      trade_name: "Exemplo",
      status: "Ativa",
      state: "SP",
      legalization_department_id: "5",
      legalization_responsible_name: "Fulana de Tal 101",
      legalization_responsible_email: "fulana.tal@escritorio.example",
      acessorias_updated_at: "2026-10-15T17:30:00.000Z",
      synced_at: SYNCED_AT,
    });
  });

  it("guarda só os responsáveis dos departamentos 5 e 13, com e-mail normalizado", () => {
    expect(mapped.responsibles).toEqual([
      expect.objectContaining({
        department_id: "5",
        responsible_email: "fulana.tal@escritorio.example",
      }),
      expect.objectContaining({
        department_id: "13",
        responsible_email: "beltrano.silva@escritorio.example",
      }),
    ]);
  });

  it("desconsidera responsáveis da lista de ignorados (por e-mail)", () => {
    const result = mapCompany(
      acessoriasCompanySchema.parse(companyFixture),
      {
        ...DEPARTMENTS,
        ignoredResponsibleEmails: new Set(["fulana.tal@escritorio.example"]),
      },
      SYNCED_AT,
    );
    // Fulana (depto 5) some; Beltrano (depto 13) continua.
    expect(result.responsibles.map((r) => r.department_id)).toEqual(["13"]);
    expect(result.client.legalization_department_id).toBeNull();
    expect(result.client.legalization_responsible_name).toBeNull();
    expect(result.client.legalization_responsible_email).toBeNull();
  });

  it("empresa sem a Legalização fica sem responsáveis", () => {
    const result = mapCompany(
      acessoriasCompanySchema.parse({ ...companyFixture, Departamentos: [] }),
      DEPARTMENTS,
      SYNCED_AT,
    );
    expect(result.responsibles).toEqual([]);
    expect(result.client.legalization_responsible_email).toBeNull();
  });

  it("e-mail inválido ou vazio vira null", () => {
    const result = mapCompany(
      acessoriasCompanySchema.parse({
        ...companyFixture,
        Departamentos: [
          { ID: "5", Nome: "Legalização", RespNome: "", RespEmail: "" },
        ],
      }),
      DEPARTMENTS,
      SYNCED_AT,
    );
    expect(result.responsibles[0].responsible_email).toBeNull();
    expect(result.client.legalization_responsible_name).toBeNull();
  });
});

describe("mapUser", () => {
  it("normaliza o e-mail", () => {
    expect(mapUser(acessoriasUserSchema.parse(userFixture), SYNCED_AT)).toEqual(
      {
        acessorias_user_id: "54321",
        name: "Fulana de Tal - 101",
        email: "fulana.tal@escritorio.example",
        status: "Ativo",
        synced_at: SYNCED_AT,
      },
    );
  });
});

describe("mapRequest", () => {
  it("mapeia campos e converte datas de Brasília para UTC", () => {
    const row = mapRequest(
      acessoriasRequestSchema.parse(requestFixture),
      SYNCED_AT,
    );
    expect(row).toMatchObject({
      acessorias_request_id: "987654",
      acessorias_company_id: "1234",
      company_document_number: "11.222.333/0001-81",
      department_id: "5",
      subject: "Renovação do alvará de funcionamento",
      office_responsibles: ["Fulana de Tal"],
      office_responsible_ids: ["54321"],
      opened_at: "2026-10-01T12:00:00.000Z",
      last_update_at: "2026-10-14T19:45:10.000Z",
      due_at: null,
      completed_at: null,
    });
  });

  it("prazo só com data vira meia-noite de Brasília", () => {
    for (const prazo of ["20/10/2026", "2026-10-20"]) {
      const row = mapRequest(
        acessoriasRequestSchema.parse({ ...requestFixture, SolDTPrazo: prazo }),
        SYNCED_AT,
      );
      expect(row.due_at).toBe("2026-10-20T03:00:00.000Z");
    }
  });

  it("aceita listas ausentes", () => {
    const { SolOfficeResp: _a, SolOfficeRespID: _b, ...rest } = requestFixture;
    const row = mapRequest(acessoriasRequestSchema.parse(rest), SYNCED_AT);
    expect(row.office_responsibles).toEqual([]);
  });
});
