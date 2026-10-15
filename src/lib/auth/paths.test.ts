import { describe, expect, it } from "vitest";

import {
  HOME_PATH,
  isLoginErrorCode,
  isPublicPath,
  safeNextPath,
} from "./paths";

describe("isPublicPath", () => {
  it.each([
    ["/login", true],
    ["/login/", true],
    ["/auth/signout", true],
    ["/loginx", false],
    ["/dashboard", false],
    ["/", false],
    ["/authx", false],
  ])("%s -> %s", (path, expected) => {
    expect(isPublicPath(path)).toBe(expected);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/clients/123?aba=vencimentos", "/clients/123?aba=vencimentos"],
    ["/expirations", "/expirations"],
  ])("aceita caminho interno %s", (value, expected) => {
    expect(safeNextPath(value)).toBe(expected);
  });

  it.each([
    [undefined],
    [null],
    [""],
    ["https://evil.example"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["dashboard"],
    ["/login"],
    ["/login?next=/x"],
    ["/auth/signout"],
    ["/ok\nSet-Cookie: x"],
  ])("rejeita %j", (value) => {
    expect(safeNextPath(value)).toBe(HOME_PATH);
  });
});

describe("isLoginErrorCode", () => {
  it("aceita apenas códigos conhecidos", () => {
    expect(isLoginErrorCode("sem-acesso")).toBe(true);
    expect(isLoginErrorCode("falha-microsoft")).toBe(true);
    expect(isLoginErrorCode("<script>")).toBe(false);
    // Chaves herdadas do protótipo não podem passar.
    expect(isLoginErrorCode("toString")).toBe(false);
    expect(isLoginErrorCode("constructor")).toBe(false);
    expect(isLoginErrorCode(undefined)).toBe(false);
  });
});
