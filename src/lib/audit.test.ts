import { describe, expect, it } from "vitest";

import { auditChanges, auditRecordLabel, auditTone } from "./audit";

describe("auditChanges", () => {
  it("lista só os campos alterados, sem ruído técnico", () => {
    expect(
      auditChanges(
        {
          hierarchy_level: "USER",
          manager_id: "a",
          name: "X",
          updated_at: "1",
        },
        {
          hierarchy_level: "LEADER",
          manager_id: "b",
          name: "X",
          updated_at: "2",
        },
      ),
    ).toEqual([
      { field: "hierarchy_level", before: "USER", after: "LEADER" },
      { field: "manager_id", before: "a", after: "b" },
    ]);
  });

  it("na criação mostra os campos preenchidos", () => {
    expect(
      auditChanges(null, { name: "Nova", job_title: null, email: "n@t.local" }),
    ).toEqual([
      { field: "email", before: undefined, after: "n@t.local" },
      { field: "name", before: undefined, after: "Nova" },
    ]);
  });

  it("compara valores estruturados", () => {
    expect(auditChanges({ list: [1, 2] }, { list: [1, 2] })).toEqual([]);
  });
});

describe("auditRecordLabel", () => {
  it("usa o documento para vencimentos e o nome para usuários", () => {
    expect(
      auditRecordLabel("legal_expirations", null, {
        document_name: "CND Federal",
      }),
    ).toBe("CND Federal");
    expect(auditRecordLabel("legal_profiles", { name: "Antes" }, null)).toBe(
      "Antes",
    );
  });
});

describe("auditTone", () => {
  it.each([
    ["EXPIRATION_DELETED", "danger"],
    ["PROFILE_DEACTIVATED", "danger"],
    ["EXPIRATION_RENEWAL_STARTED", "renewal"],
    ["PROFILE_CREATED", "create"],
    ["PROFILE_MANAGER_CHANGED", "update"],
  ])("%s → %s", (action, tone) => {
    expect(auditTone(action)).toBe(tone);
  });
});
