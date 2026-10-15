import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // Fora do Next, `server-only` lança no import; nos testes usamos a versão
    // vazia do próprio pacote (a mesma resolvida em React Server Components).
    alias: {
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    // Componentes React podem optar por jsdom com `// @vitest-environment jsdom`.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "supabase/tests/**/*.test.ts"],
    // O PGlite inicializa um Postgres em WebAssembly por arquivo de teste.
    hookTimeout: 60_000,
  },
});
