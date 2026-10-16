/** Erro do PostgREST/Postgres no formato retornado pelo supabase-js. */
export type DbError = { code?: string; message: string };

/** Mensagens de restrições do banco, sem expor nomes internos. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  legal_expirations_cancellation_reason_check:
    "Informe o motivo do cancelamento (até 500 caracteres).",
  legal_expirations_document_name_check:
    "Informe o documento (até 200 caracteres).",
  legal_expirations_document_number_check:
    "O número tem no máximo 100 caracteres.",
  legal_expirations_issuer_check:
    "O órgão emissor tem no máximo 200 caracteres.",
  legal_expirations_notes_check:
    "As observações têm no máximo 2000 caracteres.",
  legal_expirations_one_successor_idx: "Este vencimento já foi renovado.",
};

const GENERIC = "Não foi possível concluir a operação. Tente novamente.";

/**
 * Converte um erro do banco em mensagem para o usuário. As mensagens dos
 * triggers legal_ são escritas para o usuário e não contêm dados; as demais
 * viram uma mensagem genérica.
 */
export function userMessageFromDbError(error: DbError): string {
  for (const [constraint, message] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (error.message.includes(constraint)) return message;
  }

  switch (error.code) {
    case "42501": // insufficient_privilege / RLS
      return "Você não tem permissão para esta operação.";
    case "P0002": // no_data_found
      return "Vencimento não encontrado.";
    case "23514": // check_violation lançado pelos triggers legal_
    case "22023": // invalid_parameter_value
    case "22007": // invalid_datetime_format
    case "23502": // not_null_violation
      return error.message.startsWith("new row") ? GENERIC : error.message;
    default:
      return GENERIC;
  }
}
