import type { Enums } from "@/types/database";

/** Tipos de vencimento, na ordem de exibição (OUTRO: legal_024). */
export const EXPIRATION_TYPES = [
  "CERTIDAO",
  "LICENCA",
  "CERTIFICADO",
  "OUTRO",
] as const satisfies readonly Enums<"legal_expiration_type">[];

export const EXPIRATION_TYPE_LABELS: Record<
  Enums<"legal_expiration_type">,
  string
> = {
  CERTIDAO: "Certidão",
  LICENCA: "Licença",
  CERTIFICADO: "Certificado",
  OUTRO: "Outros",
};

/** O Acessórias anexa um código ao nome ("Fulana de Tal 101"); a tela mostra só o nome. */
export function displayPersonName(value: string): string {
  return value.replace(/\s*-?\s*\d+$/, "").trim() || value;
}

export function initials(value: string): string {
  const parts = displayPersonName(value).split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
}
