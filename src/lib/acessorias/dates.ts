import { BUSINESS_TIME_ZONE } from "@/lib/dates";

/**
 * O Acessórias devolve data/hora local de Brasília sem fuso
 * ("dd/mm/aaaa hh:mm:ss"). Converte para um instante UTC (ISO 8601),
 * considerando o horário de verão histórico. Valores vazios ou zerados → null.
 */
export function parseAcessoriasDateTime(
  value: string | null | undefined,
): string | null {
  const match = value
    ?.trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;

  const [, day, month, year, hour = "00", minute = "00", second = "00"] = match;
  const parts = [year, month, day, hour, minute, second].map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  if (!isValidCivilDateTime(...parts)) return null;

  return zonedToUtc(...parts, BUSINESS_TIME_ZONE).toISOString();
}

/** Datas civis "aaaa-mm-dd" ou "dd/mm/aaaa" → "aaaa-mm-dd"; "0000-00-00" → null. */
export function parseAcessoriasDate(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() ?? "";
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const br = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const [year, month, day] = iso
    ? [iso[1], iso[2], iso[3]]
    : br
      ? [br[3], br[2], br[1]]
      : [];
  if (!year || !isValidCivilDateTime(+year, +month!, +day!, 0, 0, 0))
    return null;
  return `${year}-${month}-${day}`;
}

/** Instante → "aaaa-mm-dd hh:mm:ss" no horário de Brasília (parâmetro DtLastDH). */
export function formatAcessoriasDateTime(instant: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: BUSINESS_TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/** Instante → "aaaa-mm-dd" no horário de Brasília (filtros de data da API). */
export function formatAcessoriasDate(instant: Date): string {
  return formatAcessoriasDateTime(instant).slice(0, 10);
}

function isValidCivilDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): boolean {
  if (year < 1900 || month < 1 || month > 12 || day < 1) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/** Diferença (ms) entre o relógio local do fuso e o UTC naquele instante. */
function timeZoneOffset(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)]),
  );
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstGuess = wallClock - timeZoneOffset(new Date(wallClock), timeZone);
  // Segunda passada corrige o caso em que o palpite cai do outro lado de uma
  // mudança de horário de verão.
  return new Date(wallClock - timeZoneOffset(new Date(firstGuess), timeZone));
}
