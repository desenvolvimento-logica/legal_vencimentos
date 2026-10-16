import type { Enums } from "@/types/database";

export type RenewalPeriod = Enums<"legal_renewal_period">;

export const RENEWAL_PERIODS = [
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
] as const satisfies readonly RenewalPeriod[];

export const RENEWAL_PERIOD_LABELS: Record<RenewalPeriod, string> = {
  MONTHLY: "Mensal",
  BIMONTHLY: "Bimestral",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
};

const MONTHS: Record<RenewalPeriod, number> = {
  MONTHLY: 1,
  BIMONTHLY: 2,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

export function isRenewalPeriod(value: unknown): value is RenewalPeriod {
  return (
    typeof value === "string" &&
    (RENEWAL_PERIODS as readonly string[]).includes(value)
  );
}

/**
 * Vencimento = emissão + periodicidade, como legal_period_expiration_date
 * (legal_020): se o dia não existe no mês final, usa o último dia
 * (31/01 + 1 mês = 28/02). O banco recalcula; aqui é só a prévia do form.
 */
export function periodExpirationDate(
  issueDate: string,
  period: RenewalPeriod,
): string {
  const [year, month, day] = issueDate.split("-").map(Number);
  const target = month - 1 + MONTHS[period];
  const targetYear = year + Math.floor(target / 12);
  const targetMonth = target % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const date = new Date(
    Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)),
  );
  return date.toISOString().slice(0, 10);
}
