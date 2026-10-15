// Dispara a sincronização com o Acessórias em um servidor do app (por padrão,
// o `npm run dev` local) e mostra o progresso. Usado na carga inicial, que
// excede o tempo máximo de uma função na Vercel.
//
//   npm run sync -- companies users requests --full
//   npm run sync -- requests                     (incremental)
//   npm run sync -- companies --url=https://...  (outro servidor)
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const types = args.filter((arg) => !arg.startsWith("--"));
const mode = args.includes("--full") ? "full" : "incremental";
const url =
  args.find((arg) => arg.startsWith("--url="))?.slice("--url=".length) ??
  "http://localhost:3000";
const secret = process.env.CRON_SECRET;

if (types.length === 0) {
  console.error(
    "Uso: npm run sync -- <companies|users|requests>... [--full] [--url=...]",
  );
  process.exit(1);
}
if (!secret) {
  console.error("CRON_SECRET não definido no .env.local.");
  process.exit(1);
}

console.log(`Sincronizando ${types.join(", ")} (${mode}) em ${url}…`);
const response = await fetch(new URL("/api/sync", url), {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ types, mode }),
});

if (!response.ok || !response.body) {
  console.error(`Falha: HTTP ${response.status} ${await response.text()}`);
  process.exit(1);
}

let buffer = "";
let failed = false;
const decoder = new TextDecoder();
for await (const chunk of response.body) {
  buffer += decoder.decode(chunk, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines.filter(Boolean)) {
    const event = JSON.parse(line);
    if (event.event === "progress") {
      const c = event.counters;
      process.stdout.write(
        `\r  ${event.type}: página ${event.page} — recebidos ${c.received}, novos ${c.created}, atualizados ${c.updated}, falhas ${c.failed}   `,
      );
    } else if (event.event === "done") {
      process.stdout.write("\n");
      for (const result of event.results) {
        console.log(
          `${result.type}: ${result.status}${result.errorMessage ? ` — ${result.errorMessage}` : ""}`,
        );
        if (result.status !== "SUCCESS") failed = true;
      }
    } else if (event.event === "error") {
      console.error(`\nErro: ${event.message}`);
      failed = true;
    }
  }
}
process.exit(failed ? 1 : 0);
