import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite, type Transaction } from "@electric-sql/pglite";

const SUPABASE_DIR = fileURLToPath(new URL("..", import.meta.url));
const MIGRATIONS_DIR = join(SUPABASE_DIR, "migrations");

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^legal_\d{3}_.+\.sql$/.test(name))
    .sort();
}

export async function applyMigrations(db: PGlite): Promise<void> {
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
}

/** Banco em memória com o stub do Supabase; nunca conecta ao projeto real. */
export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(
    readFileSync(join(SUPABASE_DIR, "tests", "supabase_stub.sql"), "utf8"),
  );
  return db;
}

type Role = "anon" | "authenticated" | "service_role";

type Claims = Record<string, unknown>;

/** Claims de uma sessão criada pelo login Microsoft (Azure/Entra ID). */
export function microsoftClaims(userId: string): Claims {
  return {
    sub: userId,
    role: "authenticated",
    amr: [{ method: "oauth", timestamp: 1_760_000_000 }],
    app_metadata: { provider: "azure", providers: ["azure"] },
  };
}

/** Claims de uma sessão criada por e-mail e senha. */
export function passwordClaims(userId: string): Claims {
  return {
    sub: userId,
    role: "authenticated",
    amr: [{ method: "password", timestamp: 1_760_000_000 }],
    app_metadata: { provider: "email", providers: ["email", "azure"] },
  };
}

/** Aplica papel e claims JWT na transação, como o PostgREST faz. */
export async function setSession(
  tx: Transaction,
  role: Role,
  claims: Claims,
): Promise<void> {
  await tx.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify(claims),
  ]);
  await tx.exec(`set local role ${role}`);
}

/**
 * Executa `fn` com o papel e as claims informados, simulando a requisição do
 * PostgREST. A transação é sempre desfeita, para que cada verificação parta
 * do mesmo estado.
 */
export async function runAs<T>(
  db: PGlite,
  role: Role,
  claims: Claims,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  let result: T;
  try {
    await db.transaction(async (tx) => {
      await setSession(tx, role, claims);
      result = await fn(tx);
      await tx.rollback();
    });
  } catch (error) {
    if (!isRollbackSignal(error)) throw error;
  }
  return result!;
}

function isRollbackSignal(error: unknown): boolean {
  return error instanceof Error && /rollback/i.test(error.message);
}

export function asUser<T>(
  db: PGlite,
  userId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return runAs(db, "authenticated", microsoftClaims(userId), fn);
}

/** Captura o erro de banco esperado; falha se a operação tiver sucesso. */
export async function expectDbError(
  promise: Promise<unknown>,
): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Era esperado um erro do banco, mas a operação foi aceita");
}
