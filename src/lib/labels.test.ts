import { describe, expect, it } from "vitest";

import { displayPersonName, initials } from "./labels";

describe("displayPersonName", () => {
  it.each([
    ["Fulana de Tal 101", "Fulana de Tal"],
    ["Fulana de Tal - 101", "Fulana de Tal"],
    ["Fulana de Tal", "Fulana de Tal"],
    ["123", "123"],
  ])("%j → %j", (value, expected) => {
    expect(displayPersonName(value)).toBe(expected);
  });
});

describe("initials", () => {
  it("usa primeira e última palavra, ignorando o código", () => {
    expect(initials("Fulana de Tal 101")).toBe("FT");
    expect(initials("Beltrano")).toBe("B");
  });
});
