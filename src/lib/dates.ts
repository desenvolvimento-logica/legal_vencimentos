/** Fuso de negócio do sistema (SRS RF-07). Nunca usar o fuso implícito da máquina. */
export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

const longDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Ex.: "15 de outubro de 2026", no fuso de negócio. */
export function formatLongDate(instant: Date): string {
  return longDateFormatter.format(instant);
}

/**
 * Data civil "aaaa-mm-dd" → "dd/MM/aaaa", sem conversão de fuso (uma data de
 * vencimento não tem horário e não pode mudar de dia).
 */
export function formatCivilDate(value: string | null | undefined): string {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

const civilDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data civil "aaaa-mm-dd" de um instante no fuso de negócio (ex.: hoje). */
export function toBusinessCivilDate(instant: Date): string {
  return civilDateFormatter.format(instant);
}

/** Soma dias a uma data civil "aaaa-mm-dd" (sem fuso). */
export function addCivilDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
