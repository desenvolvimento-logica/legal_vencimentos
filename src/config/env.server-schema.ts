import { z } from "zod";

import { formatEnvError } from "./env";

export const DEFAULT_ACESSORIAS_API_URL = "https://api.acessorias.com";

export const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  ACESSORIAS_API_URL: z.url().default(DEFAULT_ACESSORIAS_API_URL),
  ACESSORIAS_API_TOKEN: z.string().min(1),
  /** Protege /api/sync (Vercel Cron envia "Authorization: Bearer <CRON_SECRET>"). */
  CRON_SECRET: z.string().min(32),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

// Segredos expostos com NEXT_PUBLIC_ seriam embutidos no bundle do browser.
const FORBIDDEN_PUBLIC_NAMES = [
  "NEXT_PUBLIC_SUPABASE_SECRET_KEY",
  "NEXT_PUBLIC_ACESSORIAS_API_TOKEN",
  "NEXT_PUBLIC_CRON_SECRET",
];

export function parseServerEnv(
  source: Record<string, string | undefined>,
): ServerEnv {
  const leaked = FORBIDDEN_PUBLIC_NAMES.filter((name) => source[name]);
  if (leaked.length > 0) {
    throw new Error(
      `Segredos não podem usar o prefixo NEXT_PUBLIC_: ${leaked.join(", ")}`,
    );
  }

  const result = serverEnvSchema.safeParse({
    SUPABASE_SECRET_KEY: source.SUPABASE_SECRET_KEY,
    // Valor vazio no .env equivale a não definido, para aplicar o default.
    ACESSORIAS_API_URL: source.ACESSORIAS_API_URL || undefined,
    ACESSORIAS_API_TOKEN: source.ACESSORIAS_API_TOKEN,
    CRON_SECRET: source.CRON_SECRET,
  });
  if (!result.success) {
    throw new Error(formatEnvError(result.error, "do servidor"));
  }
  return result.data;
}
