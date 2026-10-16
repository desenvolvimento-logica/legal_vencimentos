import { describe, expect, it } from "vitest";

import {
  buildTree,
  filterTree,
  withoutManager,
  type TreeProfile,
} from "./tree";

const p = (
  id: string,
  level: TreeProfile["level"],
  managerId: string | null = null,
  active = true,
): TreeProfile => ({
  id,
  name: `Pessoa ${id}`,
  email: `${id}@t.local`,
  level,
  managerId,
  active,
});

const PROFILES = [
  p("dir", "DIRECTOR"),
  p("ger", "MANAGER", "dir"),
  p("coo", "COORDINATOR", "ger"),
  p("lid", "LEADER", "coo"),
  p("usr", "USER", "lid"),
  p("orfao", "USER"),
  p("adm", "ADMIN"),
  p("perdido", "USER", "inexistente"),
];

const ids = (nodes: ReturnType<typeof buildTree>): unknown =>
  nodes.map((node) => [node.id, ids(node.children)]);

describe("buildTree", () => {
  it("monta a cadeia e deixa ADMIN fora da árvore operacional", () => {
    expect(ids(buildTree(PROFILES))).toEqual([
      ["dir", [["ger", [["coo", [["lid", [["usr", []]]]]]]]]],
      ["orfao", []],
      ["perdido", []], // gestor inexistente vira raiz
    ]);
  });

  it("não entra em loop com ciclo nos dados", () => {
    const cyclic = [p("a", "LEADER", "b"), p("b", "MANAGER", "a")];
    expect(() => buildTree(cyclic)).not.toThrow();
  });
});

describe("filterTree", () => {
  it("mantém o caminho até quem corresponde à busca", () => {
    expect(ids(filterTree(buildTree(PROFILES), "usr@"))).toEqual([
      ["dir", [["ger", [["coo", [["lid", [["usr", []]]]]]]]]],
    ]);
  });

  it("busca vazia não filtra", () => {
    expect(filterTree(buildTree(PROFILES), "  ")).toHaveLength(3);
  });
});

describe("withoutManager", () => {
  it("ignora o topo (diretor/admin) e inativos", () => {
    const list = [...PROFILES, p("inativo", "USER", null, false)];
    // "perdido" tem manager_id preenchido (no banco a FK garante que existe).
    expect(withoutManager(list).map((item) => item.id)).toEqual(["orfao"]);
  });
});
