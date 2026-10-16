import type { Enums } from "@/types/database";

export type ExpirationStatus = Enums<"legal_expiration_status">;

export type DisplayTone =
  "danger" | "orange" | "warning" | "info" | "success" | "neutral" | "quote";

export type DisplayStatus = {
  /** Rótulo exibido sempre junto do ícone (cor nunca é a única pista). */
  label: string;
  tone: DisplayTone;
  icon: "alert" | "clock" | "calendar" | "refresh" | "check" | "ban" | "send";
  /** Dias até o vencimento (negativo = vencido). */
  daysLeft: number;
};

/** Diferença em dias civis entre duas datas "aaaa-mm-dd" (sem fuso). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

/**
 * Situação exibida (SRS RF-07). Um registro ACTIVE com data passada aparece
 * como vencido mesmo sem job que grave EXPIRED. `today` é a data civil de
 * negócio (America/Sao_Paulo). Faixas: 0–7, 8–15, 16–30 dias (limites
 * inclusivos, DEVELOPMENT.md §8).
 */
export function displayStatus(
  status: ExpirationStatus,
  expirationDate: string,
  today: string,
): DisplayStatus {
  const daysLeft = daysBetween(today, expirationDate);

  switch (status) {
    case "RENEWED":
      return { label: "Renovado", tone: "success", icon: "check", daysLeft };
    case "CANCELLED":
      return { label: "Cancelado", tone: "neutral", icon: "ban", daysLeft };
    case "RENEWING":
      return { label: "Em renovação", tone: "info", icon: "refresh", daysLeft };
    case "QUOTE_SENT":
      return {
        label: "Orçamento enviado",
        tone: "quote",
        icon: "send",
        daysLeft,
      };
    case "EXPIRED":
      return { label: "Vencido", tone: "danger", icon: "alert", daysLeft };
    case "ACTIVE":
      if (daysLeft < 0)
        return { label: "Vencido", tone: "danger", icon: "alert", daysLeft };
      if (daysLeft === 0)
        return { label: "Vence hoje", tone: "orange", icon: "clock", daysLeft };
      if (daysLeft <= 7)
        return {
          label: daysLabel(daysLeft),
          tone: "orange",
          icon: "clock",
          daysLeft,
        };
      if (daysLeft <= 15)
        return {
          label: daysLabel(daysLeft),
          tone: "warning",
          icon: "clock",
          daysLeft,
        };
      if (daysLeft <= 30)
        return {
          label: daysLabel(daysLeft),
          tone: "info",
          icon: "calendar",
          daysLeft,
        };
      return { label: "Ativo", tone: "success", icon: "check", daysLeft };
  }
}

function daysLabel(days: number): string {
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}
