// Falha cedo na inicialização do servidor se as variáveis públicas estiverem
// ausentes. As variáveis secretas são validadas no primeiro uso server-side,
// pois só são necessárias a partir da integração com o Acessórias.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getPublicEnv } = await import("./config/env");
    getPublicEnv();
  }
}
