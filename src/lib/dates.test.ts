import { describe, expect, it } from "vitest";

import {
  addCivilDays,
  formatCivilDate,
  formatLongDate,
  toBusinessCivilDate,
} from "./dates";

describe("formatLongDate", () => {
  it("formata por extenso em português", () => {
    expect(formatLongDate(new Date("2026-10-15T15:00:00Z"))).toBe(
      "15 de outubro de 2026",
    );
  });

  it("usa o fuso de São Paulo, não o UTC, na virada do dia", () => {
    // 02:30 UTC de 16/10 ainda é 23:30 de 15/10 em São Paulo (UTC-3).
    expect(formatLongDate(new Date("2026-10-16T02:30:00Z"))).toBe(
      "15 de outubro de 2026",
    );
  });

  it("vira o ano conforme São Paulo", () => {
    expect(formatLongDate(new Date("2027-01-01T02:59:00Z"))).toBe(
      "31 de dezembro de 2026",
    );
    expect(formatLongDate(new Date("2027-01-01T03:00:00Z"))).toBe(
      "1 de janeiro de 2027",
    );
  });
});

describe("formatCivilDate", () => {
  it("formata sem depender do fuso", () => {
    expect(formatCivilDate("2026-01-01")).toBe("01/01/2026");
  });

  it.each([[null], [undefined], [""], ["2026-1-1"]])(
    "vazio para %j",
    (value) => {
      expect(formatCivilDate(value)).toBe("");
    },
  );
});

describe("toBusinessCivilDate", () => {
  it("usa o dia de São Paulo, não o de UTC", () => {
    expect(toBusinessCivilDate(new Date("2026-10-16T02:30:00Z"))).toBe(
      "2026-10-15",
    );
    expect(toBusinessCivilDate(new Date("2026-10-16T03:00:00Z"))).toBe(
      "2026-10-16",
    );
  });
});

describe("addCivilDays", () => {
  it("atravessa mês, ano e fevereiro bissexto", () => {
    expect(addCivilDays("2026-10-15", 7)).toBe("2026-10-22");
    expect(addCivilDays("2026-12-25", 60)).toBe("2027-02-23");
    expect(addCivilDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});
