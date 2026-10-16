import type { Enums } from "@/types/database";

export type HierarchyLevel = Enums<"legal_hierarchy_level">;

/** Ordem da hierarquia (AUTHORIZATION.md §3): cada nível está acima dos anteriores. */
export const LEVELS: HierarchyLevel[] = [
  "USER",
  "LEADER",
  "COORDINATOR",
  "MANAGER",
  "DIRECTOR",
  "ADMIN",
];

/**
 * Gestores possíveis para um nível: ativos, de nível estritamente acima e
 * fora da árvore operacional do ADMIN (AUTHORIZATION.md §4). O banco revalida.
 */
export function managerOptionsFor<
  T extends { id: string; level: HierarchyLevel; active: boolean },
>(profiles: T[], level: HierarchyLevel, excludeId?: string) {
  if (level === "ADMIN" || level === "DIRECTOR") return [];
  const rank = LEVELS.indexOf(level);
  return profiles.filter(
    (profile) =>
      profile.active &&
      profile.id !== excludeId &&
      profile.level !== "ADMIN" &&
      LEVELS.indexOf(profile.level) > rank,
  );
}
