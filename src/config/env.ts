import { z } from "zod";

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Lista apenas os nomes das variáveis inválidas; nunca inclui valores,
 * porque a mensagem pode acabar em logs.
 */
export function formatEnvError(error: z.ZodError, scope: string): string {
  const names = [...new Set(error.issues.map((issue) => issue.path.join(".")))];
  return `Variáveis de ambiente ${scope} ausentes ou inválidas: ${names.join(", ")}`;
}

export function parsePublicEnv(
  source: Record<string, string | undefined>,
): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(formatEnvError(result.error, "públicas"));
  }
  return result.data;
}

let cachedPublicEnv: PublicEnv | undefined;

export function getPublicEnv(): PublicEnv {
  // O Next só embute NEXT_PUBLIC_* no bundle quando referenciadas literalmente.
  cachedPublicEnv ??= parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return cachedPublicEnv;
}
