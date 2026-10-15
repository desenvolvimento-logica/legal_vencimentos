type ParamValue = string | number | undefined | null;

/** Monta href com os parâmetros atuais sobrescritos; vazios são omitidos. */
export function hrefWith(
  pathname: string,
  current: Record<string, ParamValue>,
  overrides: Record<string, ParamValue> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...overrides })) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
