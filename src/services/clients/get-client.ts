import "server-only";

import { z } from "zod";

import type { ExpirationStatus } from "@/lib/expirations/display-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export type ClientDetail = {
  id: string;
  acessoriasCompanyId: string;
  corporateName: string;
  tradeName: string | null;
  documentNumber: string | null;
  status: string | null;
  responsibles: {
    departmentId: string;
    departmentName: string | null;
    name: string | null;
    email: string | null;
  }[];
};

export type ClientExpiration = {
  id: string;
  type: Enums<"legal_expiration_type">;
  documentName: string;
  documentNumber: string | null;
  issuer: string | null;
  expirationDate: string;
  status: ExpirationStatus;
};

export type ClientRequest = {
  id: string;
  acessoriasRequestId: string;
  subject: string | null;
  type: string | null;
  priority: string | null;
  status: string | null;
  departmentName: string | null;
  officeResponsibles: string[];
  openedAt: string | null;
  dueAt: string | null;
  lastUpdateAt: string | null;
};

const uuidSchema = z.uuid();

/**
 * Cliente visível ao usuário atual, ou null. Inexistente e fora do escopo
 * são indistinguíveis (o RLS filtra), para não vazar dados.
 */
export async function getClientDetail(
  id: string,
): Promise<ClientDetail | null> {
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();

  const { data: client, error } = await supabase
    .from("legal_clients")
    .select(
      "id, acessorias_company_id, corporate_name, trade_name, document_number, status",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar o cliente.");
  if (!client) return null;

  const { data: responsibles, error: responsiblesError } = await supabase
    .from("legal_client_responsibles")
    .select(
      "department_id, department_name, responsible_name, responsible_email",
    )
    .eq("client_id", id)
    .order("department_id");
  if (responsiblesError)
    throw new Error("Não foi possível carregar os responsáveis.");

  return {
    id: client.id,
    acessoriasCompanyId: client.acessorias_company_id,
    corporateName: client.corporate_name,
    tradeName: client.trade_name,
    documentNumber: client.document_number,
    status: client.status,
    responsibles: responsibles.map((row) => ({
      departmentId: row.department_id,
      departmentName: row.department_name,
      name: row.responsible_name,
      email: row.responsible_email,
    })),
  };
}

const CURRENT_STATUSES: ExpirationStatus[] = ["ACTIVE", "RENEWING", "EXPIRED"];
const HISTORY_STATUSES: ExpirationStatus[] = ["RENEWED", "CANCELLED"];

/** Vencimentos vigentes (`current`) ou encerrados (`history`) do cliente. */
export async function listClientExpirations(
  clientId: string,
  scope: "current" | "history",
): Promise<ClientExpiration[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("legal_expirations")
    .select(
      "id, expiration_type, document_name, document_number, issuer, expiration_date, status",
    )
    .eq("client_id", clientId)
    .in("status", scope === "current" ? CURRENT_STATUSES : HISTORY_STATUSES)
    .order("expiration_date", { ascending: scope === "current" })
    .limit(500);
  if (error) throw new Error("Não foi possível carregar os vencimentos.");

  return data.map((row) => ({
    id: row.id,
    type: row.expiration_type,
    documentName: row.document_name,
    documentNumber: row.document_number,
    issuer: row.issuer,
    expirationDate: row.expiration_date,
    status: row.status,
  }));
}

export const REQUESTS_PAGE_SIZE = 20;

/** Solicitações (cache somente leitura) do cliente, mais recentes primeiro. */
export async function listClientRequests(
  acessoriasCompanyId: string,
  page: number,
): Promise<{ items: ClientRequest[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const from = (page - 1) * REQUESTS_PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("legal_acessorias_requests")
    .select(
      "id, acessorias_request_id, subject, request_type, priority, status, department_name, office_responsibles, opened_at, due_at, last_update_at",
      { count: "exact" },
    )
    .eq("acessorias_company_id", acessoriasCompanyId)
    .order("last_update_at", { ascending: false, nullsFirst: false })
    .order("id")
    .range(from, from + REQUESTS_PAGE_SIZE - 1);
  if (error) throw new Error("Não foi possível carregar as solicitações.");

  return {
    total: count ?? 0,
    items: data.map((row) => ({
      id: row.id,
      acessoriasRequestId: row.acessorias_request_id,
      subject: row.subject,
      type: row.request_type,
      priority: row.priority,
      status: row.status,
      departmentName: row.department_name,
      officeResponsibles: Array.isArray(row.office_responsibles)
        ? row.office_responsibles.map(String)
        : [],
      openedAt: row.opened_at,
      dueAt: row.due_at,
      lastUpdateAt: row.last_update_at,
    })),
  };
}
