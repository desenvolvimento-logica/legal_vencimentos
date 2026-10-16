import { describe, expect, it } from "vitest";

import { requestFixture } from "./fixtures";
import {
  isAllowedAttachmentUrl,
  mapRequestDetail,
  safeFileName,
} from "./request-detail";
import { acessoriasRequestDetailSchema } from "./schemas";

// Formato real (estrutura confirmada em 16/10/2026): interações em lista aninhada.
const detailFixture = {
  ...requestFixture,
  SolUsuarioFinalizador: "",
  SolInteracoes: [
    [
      {
        CmtUsuario: "Fulana de Tal",
        CmtDH: "14/10/2026 16:45:10",
        CmtTipo: "Público",
        CmtText: "Documentação enviada.\r\rAguardando protocolo.",
        CmtAnx: [
          {
            Nome: "protocolo.pdf",
            Url: "https://app.acessorias.com/anexo.php?AnxKey=abc",
          },
          { Nome: "malicioso.exe", Url: "https://evil.example/x" },
        ],
      },
      {
        CmtUsuario: "Cliente Exemplo",
        CmtDH: "01/10/2026 09:00:00",
        CmtTipo: "Público",
        CmtText: "Comentário: Solicitação aberta",
        CmtAnx: [],
      },
    ],
  ],
};

describe("mapRequestDetail", () => {
  const detail = mapRequestDetail(
    acessoriasRequestDetailSchema.parse(detailFixture),
  );

  it("achata as interações e ordena da mais antiga para a mais recente", () => {
    expect(detail.interactions.map((item) => item.author)).toEqual([
      "Cliente Exemplo",
      "Fulana de Tal",
    ]);
    expect(detail.interactions[0].at).toBe("2026-10-01T12:00:00.000Z");
  });

  it("normaliza quebras de linha \r", () => {
    expect(detail.interactions[1].text).toBe(
      "Documentação enviada.\n\nAguardando protocolo.",
    );
  });

  it("descarta anexos fora dos hosts do Acessórias", () => {
    expect(detail.interactions[1].attachments.map((a) => a.name)).toEqual([
      "protocolo.pdf",
    ]);
  });
});

describe("isAllowedAttachmentUrl", () => {
  it.each([
    ["https://app.acessorias.com/anexo.php?AnxKey=1", true],
    ["http://app.acessorias.com/anexo.php", false],
    ["https://app.acessorias.com.evil.example/x", false],
    ["https://user:pass@app.acessorias.com/x", false],
    ["https://app.acessorias.com:8443/x", false],
    ["file:///etc/passwd", false],
    ["não é url", false],
  ])("%s → %s", (url, expected) => {
    expect(isAllowedAttachmentUrl(url)).toBe(expected);
  });
});

describe("safeFileName", () => {
  it.each([
    ["Requerimento Licença.pdf", "Requerimento Licença.pdf"],
    ["../../etc/passwd", "_.._etc_passwd"],
    ['a"b\r\nc.pdf', "a_b_c.pdf"],
    ["", "anexo"],
  ])("%j → %j", (value, expected) => {
    expect(safeFileName(value)).toBe(expected);
  });
});
