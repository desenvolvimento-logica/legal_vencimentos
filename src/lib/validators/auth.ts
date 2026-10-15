import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Informe um e-mail válido." })),
  password: z.string().min(1, { error: "Informe a senha." }).max(256),
});

export type LoginInput = z.infer<typeof loginSchema>;
