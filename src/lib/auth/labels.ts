import type { Enums } from "@/types/database";

export const HIERARCHY_LABELS: Record<
  Enums<"legal_hierarchy_level">,
  string
> = {
  USER: "Usuário",
  LEADER: "Líder",
  COORDINATOR: "Coordenador",
  MANAGER: "Gerente",
  DIRECTOR: "Diretor",
  ADMIN: "Administrador",
};
