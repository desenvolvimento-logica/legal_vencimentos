import { describe, expect, it } from "vitest";

import { managerOptionsFor } from "@/lib/admin/hierarchy";

import {
  filterProfiles,
  profileListParamsSchema,
  profileMetrics,
  type AdminProfile,
} from "./profiles";

const profile = (
  id: string,
  level: AdminProfile["level"],
  extra: Partial<AdminProfile> = {},
): AdminProfile => ({
  id,
  name: `Pessoa ${id}`,
  email: `${id}@teste.local`,
  jobTitle: null,
  level,
  managerId: null,
  active: true,
  updatedAt: "2026-10-16T12:00:00Z",
  ...extra,
});

const PROFILES = [
  profile("diretor", "DIRECTOR"),
  profile("gerente", "MANAGER", { managerId: "diretor" }),
  profile("lider", "LEADER", { managerId: "gerente" }),
  profile("usuario", "USER", { managerId: "lider" }),
  profile("orfao", "USER"),
  profile("inativo", "LEADER", { active: false }),
  profile("admin", "ADMIN"),
];

describe("profileMetrics", () => {
  it("conta ativos, inativos, gestores e sem gestor", () => {
    expect(profileMetrics(PROFILES)).toEqual({
      active: 6,
      inactive: 1,
      managers: 3, // diretor, gerente, líder (o inativo não conta)
      withoutManager: 1, // só o órfão; diretor e admin são topo
    });
  });
});

describe("managerOptionsFor", () => {
  it("só ativos de nível acima, sem ADMIN e sem o próprio perfil", () => {
    expect(
      managerOptionsFor(PROFILES, "USER", "usuario").map((p) => p.id),
    ).toEqual(["diretor", "gerente", "lider"]);
    expect(managerOptionsFor(PROFILES, "MANAGER").map((p) => p.id)).toEqual([
      "diretor",
    ]);
  });

  it("DIRECTOR e ADMIN não têm gestor", () => {
    expect(managerOptionsFor(PROFILES, "DIRECTOR")).toEqual([]);
    expect(managerOptionsFor(PROFILES, "ADMIN")).toEqual([]);
  });
});

describe("filterProfiles", () => {
  it("busca por nome ou e-mail e filtra nível e status", () => {
    const params = profileListParamsSchema.parse({
      q: "LIDER",
      status: "ativos",
    });
    expect(filterProfiles(PROFILES, params).items.map((p) => p.id)).toEqual([
      "lider",
    ]);
    const inactive = profileListParamsSchema.parse({ status: "inativos" });
    expect(filterProfiles(PROFILES, inactive).total).toBe(1);
  });

  it("pagina no servidor", () => {
    const params = profileListParamsSchema.parse({
      porPagina: "10",
      pagina: "2",
    });
    expect(filterProfiles(PROFILES, params)).toEqual({ items: [], total: 7 });
  });
});
