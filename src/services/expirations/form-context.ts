"use server";

import { z } from "zod";

import { getSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClientDetail } from "@/services/clients/get-client";

import { getResponsibleChoices, type ResponsibleChoices } from "./responsibles";

export type ClientOption = {
  id: string;
  name: string;
  document: string | null;
};

const querySchema = z.string().trim().min(2).max(100);

/** Busca clientes visíveis para cadastrar um vencimento fora do detalhe do cliente. */
export async function searchClientsForExpiration(
  input: unknown,
): Promise<ClientOption[]> {
  const parsed = querySchema.safeParse(input);
  if (!parsed.success) return [];
  const session = await getSessionState();
  if (session.status !== "active") return [];

  const term = parsed.data.replace(/[\\%_]/g, (char) => `\\${char}`);
  const digits = parsed.data.replace(/\D/g, "");
  const supabase = await createSupabaseServerClient();

  // Dígitos suficientes para um CNPJ parcial buscam pelo documento; senão, pelo nome.
  const query = supabase
    .from("legal_client_overview")
    .select("id, corporate_name, document_number")
    .order("corporate_name")
    .limit(10);
  const { data, error } =
    digits.length >= 4 &&
    digits.length === parsed.data.replace(/[\s./-]/g, "").length
      ? await query.ilike("document_digits", `%${digits}%`)
      : await query.ilike("corporate_name", `%${term}%`);
  if (error) return [];

  return data.map((row) => ({
    id: row.id!,
    name: row.corporate_name!,
    document: row.document_number,
  }));
}

export type ExpirationFormContext = {
  client: { id: string; name: string };
} & ResponsibleChoices;

/** Dados para abrir o formulário de novo vencimento de um cliente. */
export async function getExpirationFormContext(
  clientId: unknown,
): Promise<ExpirationFormContext | null> {
  const parsed = z.uuid().safeParse(clientId);
  if (!parsed.success) return null;
  const session = await getSessionState();
  if (session.status !== "active") return null;

  const client = await getClientDetail(parsed.data);
  if (!client) return null;
  const choices = await getResponsibleChoices(client);
  return { client: { id: client.id, name: client.corporateName }, ...choices };
}
