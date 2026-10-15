export const LOGIN_PATH = "/login";
export const HOME_PATH = "/dashboard";
export const AUTH_CALLBACK_PATH = "/auth/callback";

/**
 * Destino pós-login guardado durante o OAuth. Fica fora da URL de retorno
 * porque o Supabase só aceita `redirectTo` idêntico às Redirect URLs cadastradas.
 */
export const NEXT_PATH_COOKIE = "legal_auth_next";

// /api/sync não usa sessão: a rota exige o CRON_SECRET.
const PUBLIC_PREFIXES = [LOGIN_PATH, "/auth/", "/api/sync"];

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
  "sem-acesso": "Sua conta Microsoft não tem acesso ativo a este sistema.",
  "falha-microsoft":
    "Não foi possível entrar com a conta Microsoft. Tente novamente.",
  "falha-verificacao":
    "Não foi possível verificar seu acesso. Tente novamente em instantes.",
} as const;

export type LoginErrorCode = keyof typeof LOGIN_ERRORS;

export function isLoginErrorCode(value: unknown): value is LoginErrorCode {
  return typeof value === "string" && Object.hasOwn(LOGIN_ERRORS, value);
}
