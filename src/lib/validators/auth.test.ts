import { describe, expect, it } from "vitest";

import { loginSchema } from "./auth";

describe("loginSchema", () => {
  it("normaliza o e-mail", () => {
    const result = loginSchema.parse({
      email: "  Fulano@Exemplo.COM ",
      password: "segredo",
    });
    expect(result.email).toBe("fulano@exemplo.com");
  });

  it("rejeita e-mail inválido e senha vazia com mensagens em português", () => {
    const result = loginSchema.safeParse({ email: "fulano", password: "" });
    expect(result.success).toBe(false);
    const errors = result.error?.flatten().fieldErrors;
    expect(errors?.email).toEqual(["Informe um e-mail válido."]);
    expect(errors?.password).toEqual(["Informe a senha."]);
  });
});
