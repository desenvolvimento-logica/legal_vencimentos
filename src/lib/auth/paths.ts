export const LOGIN_PATH = "/login";
export const HOME_PATH = "/dashboard";

const PUBLIC_PREFIXES = [LOGIN_PATH, "/auth/"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`),
  );
}

/**
 * Destino pós-login vindo da URL. Aceita apenas caminhos internos para impedir
 * open redirect (`//evil.com`, `/\evil.com`, URLs absolutas).
 */
export function safeNextPath(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    /[\u0000-\u001f]/.test(value) ||
    isPublicPath(value.split(/[?#]/, 1)[0])
  ) {
    return HOME_PATH;
  }
  return value;
}

export const LOGIN_ERRORS = {
  "sem-acesso": "Seu usuário não tem acesso ativo a este sistema.",
} as const;

export type LoginErrorCode = keyof typeof LOGIN_ERRORS;

export function isLoginErrorCode(value: unknown): value is LoginErrorCode {
  return typeof value === "string" && value in LOGIN_ERRORS;
}
