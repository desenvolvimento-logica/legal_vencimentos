import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export const AUDIT_PAGE_SIZE = 20;

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

export const auditParamsSchema = z.object({
  usuario: z.uuid().optional().catch(undefined),
  acao: z
    .string()
    .regex(/^[A-Z_]{3,60}$/)
    .optional()
    .catch(undefined),
  entidade: z
    .enum(["legal_expirations", "legal_profiles"])
    .optional()
    .catch(undefined),
  de: optionalDate,
  ate: optionalDate,
  pagina: z.coerce.number().int().min(1).catch(1),
  evento: z.uuid().optional().catch(undefined),
});

export type AuditParams = z.infer<typeof auditParamsSchema>;

export type AuditEvent = {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldData: Json | null;
  newData: Json | null;
  createdAt: string;
};

/** Limite do período em Brasília (UTC-3, sem horário de verão desde 2019). */
const startOfDay = (date: string) => `${date}T03:00:00.000Z`;
const endOfDay = (date: string) =>
  new Date(Date.parse(`${date}T03:00:00.000Z`) + 86_400_000 - 1).toISOString();

/** Eventos de auditoria (somente leitura; o RLS restringe ao ADMIN). */
export async function listAuditEvents(params: AuditParams) {
  const supabase = await createSupabaseServerClient();
  const from = (params.pagina - 1) * AUDIT_PAGE_SIZE;

  let query = supabase
    .from("legal_audit_logs")
    .select(
      "id, user_id, action, entity_type, entity_id, old_data, new_data, created_at",
      {
        count: "exact",
      },
    );
  if (params.usuario) query = query.eq("user_id", params.usuario);
  if (params.acao) query = query.eq("action", params.acao);
  if (params.entidade) query = query.eq("entity_type", params.entidade);
  if (params.de) query = query.gte("created_at", startOfDay(params.de));
  if (params.ate) query = query.lte("created_at", endOfDay(params.ate));

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + AUDIT_PAGE_SIZE - 1);
  if (error) throw new Error("Não foi possível carregar a auditoria.");

  return { items: data.map(toEvent), total: count ?? 0 };
}

export async function getAuditEvent(id: string): Promise<AuditEvent | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("legal_audit_logs")
    .select(
      "id, user_id, action, entity_type, entity_id, old_data, new_data, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar o evento.");
  return data ? toEvent(data) : null;
}

function toEvent(row: {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data: Json | null;
  new_data: Json | null;
  created_at: string;
}): AuditEvent {
  return {
    id: row.id,
    userId: row.user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    oldData: row.old_data,
    newData: row.new_data,
    createdAt: row.created_at,
  };
}
