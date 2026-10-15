import type { TablesInsert } from "@/types/database";

import { parseAcessoriasDate, parseAcessoriasDateTime } from "./dates";
import type {
  AcessoriasCompany,
  AcessoriasRequest,
  AcessoriasUser,
} from "./schemas";

/** Departamentos da Legalização que definem a carteira (principal + subdepartamentos). */
export type LegalizationDepartments = {
  primaryId: string;
  subdepartmentIds: string[];
};

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email.includes("@") ? email : null;
}

const nullIfEmpty = (value: string): string | null => value.trim() || null;

export type MappedCompany = {
  client: TablesInsert<"legal_clients">;
  responsibles: Omit<TablesInsert<"legal_client_responsibles">, "client_id">[];
};

export function mapCompany(
  company: AcessoriasCompany,
  departments: LegalizationDepartments,
  syncedAt: string,
): MappedCompany {
  const relevantIds = new Set([
    departments.primaryId,
    ...departments.subdepartmentIds,
  ]);
  const relevant = company.Departamentos.filter((department) =>
    relevantIds.has(department.ID),
  );
  const primary = relevant.find(
    (department) => department.ID === departments.primaryId,
  );

  return {
    client: {
      acessorias_company_id: company.ID,
      document_number: nullIfEmpty(company.Identificador),
      corporate_name: company.Razao.trim() || `Empresa ${company.ID}`,
      trade_name: nullIfEmpty(company.Fantasia),
      status: nullIfEmpty(company.Status),
      state: nullIfEmpty(company.UF),
      legalization_department_id: primary ? primary.ID : null,
      legalization_responsible_name: primary
        ? nullIfEmpty(primary.RespNome)
        : null,
      legalization_responsible_email: primary
        ? normalizeEmail(primary.RespEmail)
        : null,
      acessorias_updated_at: parseAcessoriasDateTime(company.DtLastDH),
      synced_at: syncedAt,
    },
    responsibles: relevant.map((department) => ({
      department_id: department.ID,
      department_name: nullIfEmpty(department.Nome),
      responsible_name: nullIfEmpty(department.RespNome),
      responsible_email: normalizeEmail(department.RespEmail),
      synced_at: syncedAt,
    })),
  };
}

export function mapUser(
  user: AcessoriasUser,
  syncedAt: string,
): TablesInsert<"legal_acessorias_users"> {
  return {
    acessorias_user_id: user.id,
    name: nullIfEmpty(user.nome),
    email: normalizeEmail(user.email),
    status: nullIfEmpty(user.status),
    synced_at: syncedAt,
  };
}

export function mapRequest(
  request: AcessoriasRequest,
  syncedAt: string,
): TablesInsert<"legal_acessorias_requests"> {
  return {
    acessorias_request_id: request.SolID,
    acessorias_company_id: nullIfEmpty(request.EmpID),
    company_document_number: nullIfEmpty(request.EmpCNPJ),
    company_name: nullIfEmpty(request.EmpNome),
    request_type: nullIfEmpty(request.SolTipo),
    subject: nullIfEmpty(request.SolAssunto),
    priority: nullIfEmpty(request.SolPrioridade),
    status: nullIfEmpty(request.SolStatus),
    requester_name: nullIfEmpty(request.SolUsuario),
    requester_id: nullIfEmpty(request.SolUsuarioID),
    department_id: nullIfEmpty(request.DptoID),
    department_name: nullIfEmpty(request.DptoNome),
    office_responsibles: request.SolOfficeResp,
    office_responsible_ids: request.SolOfficeRespID,
    opened_at: parseAcessoriasDateTime(request.SolDHAbertura),
    due_at: parseDueAt(request.SolDTPrazo),
    last_update_at: parseAcessoriasDateTime(request.SolDHUAt),
    completed_at: parseAcessoriasDateTime(request.SolDHFinalizacao),
    synced_at: syncedAt,
  };
}

/**
 * O prazo pode vir com ou sem hora, em "dd/mm/aaaa" ou "aaaa-mm-dd". Sem hora,
 * guarda a meia-noite de Brasília daquele dia.
 */
function parseDueAt(value: string): string | null {
  const civil = parseAcessoriasDate(value);
  return parseAcessoriasDateTime(
    civil ? civil.split("-").reverse().join("/") : value,
  );
}
