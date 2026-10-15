import { describe, expect, it } from "vitest";

import { parsePublicEnv } from "./env";
import {
  DEFAULT_ACESSORIAS_API_URL,
  parseServerEnv,
} from "./env.server-schema";

const validPublic = {
  NEXT_PUBLIC_SUPABASE_URL: "https://olyvjnqmrzkziirzbmhi.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_teste",
};

const validServer = {
  SUPABASE_SECRET_KEY: "sb_secret_teste",
  ACESSORIAS_API_TOKEN: "acessorias-secret",
};

describe("parsePublicEnv", () => {
  it("aceita variáveis públicas válidas", () => {
    expect(parsePublicEnv(validPublic)).toEqual(validPublic);
  });

  it("lista as variáveis ausentes", () => {
    expect(() => parsePublicEnv({})).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it("rejeita URL inválida", () => {
    expect(() =>
      parsePublicEnv({ ...validPublic, NEXT_PUBLIC_SUPABASE_URL: "não-é-url" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("parseServerEnv", () => {
  it("aplica a URL padrão do Acessórias quando ausente ou vazia", () => {
    expect(parseServerEnv(validServer).ACESSORIAS_API_URL).toBe(
      DEFAULT_ACESSORIAS_API_URL,
    );
    expect(
      parseServerEnv({ ...validServer, ACESSORIAS_API_URL: "" })
        .ACESSORIAS_API_URL,
    ).toBe(DEFAULT_ACESSORIAS_API_URL);
  });

  it("não inclui valores secretos na mensagem de erro", () => {
    const run = () =>
      parseServerEnv({
        ...validServer,
        ACESSORIAS_API_URL: "secreto-invalido",
      });
    expect(run).toThrow(/ACESSORIAS_API_URL/);
    expect(run).not.toThrow(/secreto-invalido|sb_secret_teste/);
  });

  it("exige os segredos do servidor", () => {
    expect(() => parseServerEnv({})).toThrow(
      /SUPABASE_SECRET_KEY, ACESSORIAS_API_TOKEN/,
    );
  });

  it("rejeita segredos com prefixo NEXT_PUBLIC_", () => {
    expect(() =>
      parseServerEnv({ ...validServer, NEXT_PUBLIC_ACESSORIAS_API_TOKEN: "x" }),
    ).toThrow(/NEXT_PUBLIC_ACESSORIAS_API_TOKEN/);
  });
});
