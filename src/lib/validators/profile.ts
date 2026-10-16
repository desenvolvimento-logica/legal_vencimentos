import { z } from "zod";

const LEVELS = [
  "USER",
  "LEADER",
  "COORDINATOR",
  "MANAGER",
  "DIRECTOR",
  "ADMIN",
] as const;

/** Campos editáveis de um perfil (formulário e servidor usam o mesmo schema). */
export const profileFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Informe o nome." })
    .max(200, { error: "Use no máximo 200 caracteres." }),
  jobTitle: z
    .string()
    .trim()
    .max(200, { error: "Use no máximo 200 caracteres." }),
  level: z.enum(LEVELS, { error: "Selecione o nível." }),
  managerId: z.union([z.literal(""), z.uuid()]),
});

export const createProfileSchema = profileFieldsSchema.extend({
  userId: z.uuid({ error: "Selecione a conta Microsoft." }),
});

export const updateProfileSchema = profileFieldsSchema.extend({
  profileId: z.uuid(),
  active: z.boolean(),
});

export type CreateProfileInput = z.input<typeof createProfileSchema>;
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
