import { LEVELS, type HierarchyLevel } from "./hierarchy";

export type TreeProfile = {
  id: string;
  name: string;
  email: string;
  level: HierarchyLevel;
  managerId: string | null;
  active: boolean;
};

export type TreeNode = TreeProfile & { children: TreeNode[] };

const byLevelThenName = (a: TreeProfile, b: TreeProfile) =>
  LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level) ||
  a.name.localeCompare(b.name, "pt-BR");

/**
 * Monta a árvore a partir de manager_id. Raízes: quem não tem gestor (ou cujo
 * gestor não está na lista). ADMIN fica fora da árvore operacional. Protegido
 * contra ciclos, embora o banco já os impeça.
 */
export function buildTree(profiles: TreeProfile[]): TreeNode[] {
  const operational = profiles.filter((profile) => profile.level !== "ADMIN");
  const ids = new Set(operational.map((profile) => profile.id));
  const childrenOf = new Map<string | null, TreeProfile[]>();
  for (const profile of operational) {
    const parent =
      profile.managerId && ids.has(profile.managerId)
        ? profile.managerId
        : null;
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), profile]);
  }

  const visited = new Set<string>();
  const build = (profile: TreeProfile): TreeNode => {
    visited.add(profile.id);
    return {
      ...profile,
      children: (childrenOf.get(profile.id) ?? [])
        .filter((child) => !visited.has(child.id))
        .sort(byLevelThenName)
        .map(build),
    };
  };
  return (childrenOf.get(null) ?? []).sort(byLevelThenName).map(build);
}

/**
 * Mantém os nós cujo nome ou e-mail contém o termo, e os seus ancestrais,
 * para a busca não esconder o caminho até a pessoa.
 */
export function filterTree(nodes: TreeNode[], term: string): TreeNode[] {
  const needle = term.trim().toLocaleLowerCase("pt-BR");
  if (!needle) return nodes;
  return nodes.flatMap((node) => {
    const children = filterTree(node.children, term);
    const matches =
      node.name.toLocaleLowerCase("pt-BR").includes(needle) ||
      node.email.includes(needle);
    return matches || children.length > 0 ? [{ ...node, children }] : [];
  });
}

/** Perfis ativos, fora do topo (DIRECTOR/ADMIN), sem gestor definido. */
export function withoutManager(profiles: TreeProfile[]): TreeProfile[] {
  return profiles.filter(
    (profile) =>
      profile.active &&
      !profile.managerId &&
      profile.level !== "DIRECTOR" &&
      profile.level !== "ADMIN",
  );
}
