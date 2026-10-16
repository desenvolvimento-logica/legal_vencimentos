import { z } from "zod";

// Formatos confirmados contra a API real em 15/10/2026 (apenas estrutura).
// Campos de texto ausentes ou nulos viram string vazia; IDs numéricos viram texto.

const text = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value) =>
    value === null || value === undefined ? "" : String(value),
  );

const id = z.union([z.string().min(1), z.number()]).transform(String);

const textList = z
  .array(z.union([z.string(), z.number()]).transform(String))
  .nullish()
  .transform((value) => value ?? []);

export const acessoriasDepartmentSchema = z.object({
  ID: id,
  Nome: text,
  IDPai: text,
});

export const acessoriasCompanyDepartmentSchema = z.object({
  ID: id,
  Nome: text,
  RespNome: text,
  RespEmail: text,
});

export const acessoriasCompanySchema = z.object({
  ID: id,
  Identificador: text,
  Razao: text,
  Fantasia: text,
  Status: text,
  UF: text,
  DtLastDH: text,
  Departamentos: z
    .array(acessoriasCompanyDepartmentSchema)
    .nullish()
    .transform((value) => value ?? []),
});

export const acessoriasUserSchema = z.object({
  id: id,
  nome: text,
  email: text,
  status: text,
});

export const acessoriasRequestSchema = z.object({
  SolID: id,
  SolTipo: text,
  SolAssunto: text,
  SolPrioridade: text,
  SolUsuario: text,
  SolUsuarioID: text,
  SolStatus: text,
  SolDHAbertura: text,
  SolDTPrazo: text,
  SolDHUAt: text,
  SolDHFinalizacao: text,
  SolOfficeResp: textList,
  SolOfficeRespID: textList,
  DptoID: text,
  DptoNome: text,
  EmpID: text,
  EmpNome: text,
  EmpCNPJ: text,
});

export type AcessoriasDepartment = z.infer<typeof acessoriasDepartmentSchema>;
export type AcessoriasCompany = z.infer<typeof acessoriasCompanySchema>;
export type AcessoriasUser = z.infer<typeof acessoriasUserSchema>;
export type AcessoriasRequest = z.infer<typeof acessoriasRequestSchema>;

const attachmentSchema = z.object({ Nome: text, Url: text });

const interactionSchema = z.object({
  CmtUsuario: text,
  CmtDH: text,
  CmtTipo: text,
  CmtText: text,
  CmtAnx: z
    .array(attachmentSchema)
    .nullish()
    .transform((value) => value ?? []),
});

/** Detalhe de `/requests/{SolID}`: interações vêm agrupadas em listas aninhadas. */
export const acessoriasRequestDetailSchema = acessoriasRequestSchema.extend({
  SolUsuarioFinalizador: text,
  SolInteracoes: z
    .array(z.union([interactionSchema, z.array(interactionSchema)]))
    .nullish()
    .transform((groups) => (groups ?? []).flat()),
});

export type AcessoriasRequestDetail = z.infer<
  typeof acessoriasRequestDetailSchema
>;
