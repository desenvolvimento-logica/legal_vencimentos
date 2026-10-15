import { describe, expect, it } from "vitest";

import { daysBetween, displayStatus } from "./display-status";

const TODAY = "2026-10-15";

describe("daysBetween", () => {
  it("conta dias civis, inclusive na virada de mês e ano", () => {
    expect(daysBetween("2026-10-15", "2026-10-16")).toBe(1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-10-15", "2026-10-14")).toBe(-1);
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2);
  });
});

describe("displayStatus", () => {
  it.each([
    ["2026-10-14", "Vencido", "danger"], // ontem
    ["2026-10-15", "Vence hoje", "orange"], // hoje fica na faixa 0–7
    ["2026-10-16", "1 dia", "orange"],
    ["2026-10-22", "7 dias", "orange"], // limite 7 pertence à 1ª faixa
    ["2026-10-23", "8 dias", "warning"],
    ["2026-10-30", "15 dias", "warning"], // limite 15 pertence à 2ª faixa
    ["2026-10-31", "16 dias", "info"],
    ["2026-11-14", "30 dias", "info"], // limite 30 pertence à 3ª faixa
    ["2026-11-15", "Ativo", "success"],
  ])("ACTIVE em %s → %s (%s)", (date, label, tone) => {
    expect(displayStatus("ACTIVE", date, TODAY)).toMatchObject({ label, tone });
  });

  it("estados persistidos prevalecem sobre a data", () => {
    expect(displayStatus("RENEWING", "2026-01-01", TODAY).label).toBe(
      "Em renovação",
    );
    expect(displayStatus("RENEWED", "2026-01-01", TODAY).label).toBe(
      "Renovado",
    );
    expect(displayStatus("CANCELLED", "2026-01-01", TODAY).label).toBe(
      "Cancelado",
    );
    expect(displayStatus("EXPIRED", "2030-01-01", TODAY).label).toBe("Vencido");
  });
});
