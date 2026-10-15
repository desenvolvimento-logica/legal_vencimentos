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
