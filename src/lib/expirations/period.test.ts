import { describe, expect, it } from "vitest";

import { periodExpirationDate } from "./period";

describe("periodExpirationDate", () => {
  it("soma meses mantendo o dia", () => {
    expect(periodExpirationDate("2026-03-10", "MONTHLY")).toBe("2026-04-10");
    expect(periodExpirationDate("2026-03-10", "BIMONTHLY")).toBe("2026-05-10");
    expect(periodExpirationDate("2026-03-10", "QUARTERLY")).toBe("2026-06-10");
    expect(periodExpirationDate("2026-03-10", "SEMIANNUAL")).toBe("2026-09-10");
    expect(periodExpirationDate("2026-03-10", "ANNUAL")).toBe("2027-03-10");
  });

  it("vira o ano", () => {
    expect(periodExpirationDate("2026-11-15", "QUARTERLY")).toBe("2027-02-15");
    expect(periodExpirationDate("2026-12-01", "MONTHLY")).toBe("2027-01-01");
  });

  it("usa o último dia quando o dia não existe (como o Postgres)", () => {
    expect(periodExpirationDate("2026-01-31", "MONTHLY")).toBe("2026-02-28");
    expect(periodExpirationDate("2028-01-31", "MONTHLY")).toBe("2028-02-29");
    expect(periodExpirationDate("2026-08-31", "SEMIANNUAL")).toBe("2027-02-28");
    expect(periodExpirationDate("2028-02-29", "ANNUAL")).toBe("2029-02-28");
  });
});
