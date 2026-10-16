import { describe, expect, it } from "vitest";

import {
  applyMetricFilter,
  businessMonthStart,
  EXPIRATION_METRICS,
} from "./metrics";

/** Registra os filtros aplicados, no lugar do query builder do PostgREST. */
class Recorder {
  calls: [string, string, unknown][] = [];
  private add(op: string, column: string, value: unknown) {
    this.calls.push([op, column, value]);
    return this;
  }
  eq(column: string, value: string) {
    return this.add("eq", column, value);
  }
  in(column: string, values: readonly string[]) {
    return this.add("in", column, values);
  }
  lt(column: string, value: string) {
    return this.add("lt", column, value);
  }
  gte(column: string, value: string) {
    return this.add("gte", column, value);
  }
  lte(column: string, value: string) {
    return this.add("lte", column, value);
  }
}

const TODAY = "2026-10-16";

describe("applyMetricFilter", () => {
  it("vencidos: ativos com data anterior a hoje", () => {
    expect(applyMetricFilter(new Recorder(), "overdue", TODAY).calls).toEqual([
      ["eq", "status", "ACTIVE"],
      ["lt", "expiration_date", TODAY],
    ]);
  });

  it("próximos N dias: vigentes de hoje até hoje + N, inclusivo", () => {
    expect(applyMetricFilter(new Recorder(), "next15", TODAY).calls).toEqual([
      ["in", "status", ["ACTIVE", "QUOTE_SENT", "RENEWING"]],
      ["gte", "expiration_date", TODAY],
      ["lte", "expiration_date", "2026-10-31"],
    ]);
  });

  it("renovados no mês: desde a meia-noite do dia 1 em Brasília", () => {
    expect(
      applyMetricFilter(new Recorder(), "renewedThisMonth", TODAY).calls,
    ).toEqual([
      ["eq", "status", "RENEWED"],
      ["gte", "renewed_at", "2026-10-01T03:00:00.000Z"],
    ]);
  });

  it("cobre todos os indicadores", () => {
    for (const metric of EXPIRATION_METRICS) {
      expect(
        applyMetricFilter(new Recorder(), metric, TODAY).calls.length,
      ).toBeGreaterThan(0);
    }
  });
});

describe("businessMonthStart", () => {
  it("usa o fuso de Brasília", () => {
    expect(businessMonthStart("2027-01-31")).toBe("2027-01-01T03:00:00.000Z");
  });
});
