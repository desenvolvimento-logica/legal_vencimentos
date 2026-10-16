import { describe, expect, it } from "vitest";

import { userMessageFromDbError } from "./db-errors";

describe("userMessageFromDbError", () => {
  it("repassa mensagens dos triggers legal_", () => {
    expect(
      userMessageFromDbError({
        code: "23514",
        message:
          "A data de vencimento só pode ser corrigida em registros ativos",
      }),
    ).toBe("A data de vencimento só pode ser corrigida em registros ativos");
  });

  it("traduz restrições sem expor o nome interno", () => {
    const message = userMessageFromDbError({
      code: "23514",
      message:
        'new row for relation "legal_expirations" violates check constraint "legal_expirations_cancellation_reason_check"',
    });
    expect(message).toBe(
      "Informe o motivo do cancelamento (até 500 caracteres).",
    );
  });

  it("violação de RLS vira falta de permissão", () => {
    expect(
      userMessageFromDbError({
        code: "42501",
        message:
          'new row violates row-level security policy for table "legal_expirations"',
      }),
    ).toBe("Você não tem permissão para esta operação.");
  });

  it("erros desconhecidos viram mensagem genérica", () => {
    expect(
      userMessageFromDbError({ code: "XX000", message: "detalhe interno" }),
    ).toBe("Não foi possível concluir a operação. Tente novamente.");
    expect(
      userMessageFromDbError({
        code: "23514",
        message: 'new row for relation "x" violates check constraint "outra"',
      }),
    ).toBe("Não foi possível concluir a operação. Tente novamente.");
  });
});
