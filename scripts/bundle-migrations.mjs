// Junta as migrations legal_ em um único arquivo transacional para colar no
// SQL Editor do Supabase. Uso: npm run db:bundle [-- legal_001 legal_009]
// (intervalo opcional, inclusivo, pelo prefixo do arquivo).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const migrationsDir = new URL("supabase/migrations/", root);
const outputDir = new URL("supabase/apply/", root);

const [from = "legal_000", to = "legal_999"] = process.argv.slice(2);
const files = readdirSync(migrationsDir)
  .filter((name) => /^legal_\d{3}_.+\.sql$/.test(name))
  .sort()
  .filter((name) => name.slice(0, 9) >= from && name.slice(0, 9) <= to);

if (files.length === 0) {
  console.error("Nenhuma migration encontrada para o intervalo informado.");
  process.exit(1);
}

const parts = files.map(
  (name) =>
    `-- ===== ${name} =====\n${readFileSync(new URL(name, migrationsDir), "utf8").trim()}\n`,
);

const bundle = [
  "-- Gerado por scripts/bundle-migrations.mjs. Não editar; não versionar.",
  `-- Migrations: ${files.join(", ")}`,
  "-- Tudo ou nada: qualquer erro desfaz o conjunto inteiro.",
  "begin;",
  "",
  ...parts,
  "commit;",
  "",
].join("\n");

mkdirSync(outputDir, { recursive: true });
const output = fileURLToPath(new URL("legal_apply.sql", outputDir));
writeFileSync(output, bundle);
console.log(`${files.length} migration(s) -> ${output}`);
