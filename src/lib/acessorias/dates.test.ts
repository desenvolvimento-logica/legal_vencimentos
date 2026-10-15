import { describe, expect, it } from "vitest";

import {
  formatAcessoriasDate,
  formatAcessoriasDateTime,
  parseAcessoriasDate,
  parseAcessoriasDateTime,
} from "./dates";

describe("parseAcessoriasDateTime", () => {
  it("converte horário de Brasília (UTC-3) para UTC", () => {
    expect(parseAcessoriasDateTime("15/10/2026 14:30:00")).toBe(
      "2026-10-15T17:30:00.000Z",
    );
  });

  it("vira o dia em UTC quando necessário", () => {
    expect(parseAcessoriasDateTime("31/12/2026 22:00:00")).toBe(
      "2027-01-01T01:00:00.000Z",
    );
  });

  it("respeita o horário de verão histórico (UTC-2 em jan/2018)", () => {
    expect(parseAcessoriasDateTime("15/01/2018 12:00:00")).toBe(
      "2018-01-15T14:00:00.000Z",
    );
  });

  it("aceita data sem hora como meia-noite local", () => {
    expect(parseAcessoriasDateTime("05/03/2026")).toBe(
      "2026-03-05T03:00:00.000Z",
    );
  });

  it.each([
    [""],
    [null],
    [undefined],
    ["00/00/0000 00:00:00"],
    ["31/02/2026 10:00:00"],
    ["2026-10-15 14:30:00"],
    ["15/10/2026 25:00:00"],
  ])("rejeita %j", (value) => {
    expect(parseAcessoriasDateTime(value)).toBeNull();
  });
});

describe("parseAcessoriasDate", () => {
  it.each([
    ["2026-10-15", "2026-10-15"],
    ["15/10/2026", "2026-10-15"],
    ["2024-02-29", "2024-02-29"],
    ["0000-00-00", null],
    ["2026-02-29", null],
    ["", null],
  ])("%j -> %j", (value, expected) => {
    expect(parseAcessoriasDate(value)).toBe(expected);
  });
});

describe("formatAcessoriasDateTime", () => {
  it("formata no horário de Brasília para o parâmetro DtLastDH", () => {
    expect(formatAcessoriasDateTime(new Date("2026-10-15T17:30:05Z"))).toBe(
      "2026-10-15 14:30:05",
    );
  });

  it("é o inverso de parseAcessoriasDateTime", () => {
    const iso = parseAcessoriasDateTime("01/03/2026 08:15:00")!;
    expect(formatAcessoriasDateTime(new Date(iso))).toBe("2026-03-01 08:15:00");
  });

  it("data civil segue Brasília na virada do dia", () => {
    expect(formatAcessoriasDate(new Date("2026-10-16T02:00:00Z"))).toBe(
      "2026-10-15",
    );
  });
});
