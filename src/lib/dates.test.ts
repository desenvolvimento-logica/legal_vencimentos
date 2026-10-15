import { describe, expect, it } from "vitest";

import { formatLongDate } from "./dates";

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
