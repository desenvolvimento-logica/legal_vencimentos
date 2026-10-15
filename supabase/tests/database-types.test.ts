import { expect, it } from "vitest";

import { generateDatabaseTypes } from "./generate-types";
import { applyMigrations, createTestDb } from "./test-db";

// Falha quando uma migration muda sem regenerar os tipos.
// Para atualizar: npm run db:types
it("src/types/database.ts corresponde às migrations", async () => {
  const db = await createTestDb();
  await applyMigrations(db);
  const generated = await generateDatabaseTypes(db);
  await expect(generated).toMatchFileSnapshot("../../src/types/database.ts");
});
