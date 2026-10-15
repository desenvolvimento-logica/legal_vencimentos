import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";

import { format, resolveConfig } from "prettier";

/**
 * Gera os tipos TypeScript do schema `legal_` no formato esperado pelo
 * supabase-js, a partir de um banco com as migrations aplicadas.
 * Equivalente local de `supabase gen types`, sem acesso ao projeto real.
 */
export async function generateDatabaseTypes(db: PGlite): Promise<string> {
  const enums = await loadEnums(db);
  const tables = await loadRelations(db, "r");
  const views = await loadRelations(db, "v");
  const relationships = await loadRelationships(db);
  const functions = await loadFunctions(db);

  const tableBlocks = Object.entries(tables).map(([table, columns]) => {
    const row = columns
      .map(
        (c) =>
          `${c.name}: ${tsType(c.type, enums)}${c.nullable ? " | null" : ""}`,
      )
      .join("\n");
    const insert = columns
      .map(
        (c) =>
          `${c.name}${c.nullable || c.hasDefault ? "?" : ""}: ${tsType(c.type, enums)}${c.nullable ? " | null" : ""}`,
      )
      .join("\n");
    const update = columns
      .map(
        (c) =>
          `${c.name}?: ${tsType(c.type, enums)}${c.nullable ? " | null" : ""}`,
      )
      .join("\n");
    const rels = (relationships[table] ?? [])
      .map(
        (r) => `{
          foreignKeyName: ${JSON.stringify(r.name)}
          columns: ${JSON.stringify(r.columns)}
          isOneToOne: ${r.oneToOne}
          referencedRelation: ${JSON.stringify(r.referencedTable)}
          referencedColumns: ${JSON.stringify(r.referencedColumns)}
        }`,
      )
      .join(",\n");
    return `${table}: {
      Row: {\n${row}\n}
      Insert: {\n${insert}\n}
      Update: {\n${update}\n}
      Relationships: [${rels}]
    }`;
  });

  // Como no supabase gen types, colunas de views são sempre anuláveis.
  const viewBlocks = Object.entries(views).map(([view, columns]) => {
    const row = columns
      .map((c) => `${c.name}: ${tsType(c.type, enums)} | null`)
      .join("\n");
    return `${view}: {
      Row: {\n${row}\n}
      Relationships: []
    }`;
  });

  const functionBlocks = functions.map((f) => {
    const args =
      f.args.length === 0
        ? "never"
        : `{ ${f.args.map((a) => `${a.name}: ${tsType(a.type, enums)}`).join("; ")} }`;
    const base = tables[f.returnType]
      ? `Database["public"]["Tables"][${JSON.stringify(f.returnType)}]["Row"]`
      : tsType(f.returnType, enums);
    return `${f.name}: { Args: ${args}; Returns: ${f.returnsSet ? `${base}[]` : base} }`;
  });

  const enumBlocks = Object.entries(enums).map(
    ([name, labels]) =>
      `${name}: ${labels.map((label) => JSON.stringify(label)).join(" | ")}`,
  );

  const source = `// Gerado por supabase/tests/generate-types.ts a partir das migrations.
// Não editar manualmente: execute \`npm run db:types\`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      ${tableBlocks.join("\n")}
    }
    Views: {
      ${viewBlocks.join("\n")}
    }
    Functions: {
      ${functionBlocks.join("\n")}
    }
    Enums: {
      ${enumBlocks.join("\n")}
    }
    CompositeTypes: { [_ in never]: never }
  }
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];
`;

  const config = await resolveConfig(
    fileURLToPath(new URL("../../src/types/database.ts", import.meta.url)),
  );
  return format(source, { ...config, parser: "typescript" });
}

const SCALAR_TYPES: Record<string, string> = {
  uuid: "string",
  text: "string",
  varchar: "string",
  date: "string",
  timestamptz: "string",
  timestamp: "string",
  bool: "boolean",
  int2: "number",
  int4: "number",
  int8: "number",
  numeric: "number",
  jsonb: "Json",
  json: "Json",
};

function tsType(pgType: string, enums: Record<string, string[]>): string {
  if (pgType in enums)
    return `Database["public"]["Enums"][${JSON.stringify(pgType)}]`;
  const mapped = SCALAR_TYPES[pgType];
  if (!mapped) throw new Error(`Tipo Postgres sem mapeamento: ${pgType}`);
  return mapped;
}

async function loadEnums(db: PGlite): Promise<Record<string, string[]>> {
  const { rows } = await db.query<{ name: string; labels: string[] }>(`
    select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public' and t.typname like 'legal\\_%'
    group by t.typname
    order by t.typname`);
  return Object.fromEntries(rows.map((r) => [r.name, r.labels]));
}

type Column = {
  name: string;
  type: string;
  nullable: boolean;
  hasDefault: boolean;
};

async function loadRelations(
  db: PGlite,
  kind: "r" | "v",
): Promise<Record<string, Column[]>> {
  const { rows } = await db.query<Column & { table: string }>(
    `
    select c.relname as table, a.attname as name, t.typname as type,
           not a.attnotnull as nullable,
           (a.atthasdef or a.attidentity <> '' or a.attgenerated <> '') as "hasDefault"
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    join pg_type t on t.oid = a.atttypid
    where n.nspname = 'public' and c.relkind = $1 and c.relname like 'legal\\_%'
    order by c.relname, a.attname`,
    [kind],
  );
  const tables: Record<string, Column[]> = {};
  for (const { table, ...column } of rows) {
    (tables[table] ??= []).push(column);
  }
  return tables;
}

type Relationship = {
  name: string;
  columns: string[];
  oneToOne: boolean;
  referencedTable: string;
  referencedColumns: string[];
};

async function loadRelationships(
  db: PGlite,
): Promise<Record<string, Relationship[]>> {
  const { rows } = await db.query<Relationship & { table: string }>(`
    select src.relname as table, con.conname as name,
      array(select a.attname from unnest(con.conkey) with ordinality k(attnum, i)
            join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
            order by k.i) as columns,
      exists (
        select 1 from pg_constraint u
        where u.conrelid = con.conrelid and u.contype in ('p', 'u')
          and u.conkey::int2[] @> con.conkey::int2[] and u.conkey::int2[] <@ con.conkey::int2[]
      ) as "oneToOne",
      ref.relname as "referencedTable",
      array(select a.attname from unnest(con.confkey) with ordinality k(attnum, i)
            join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum
            order by k.i) as "referencedColumns"
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_class ref on ref.oid = con.confrelid
    join pg_namespace n on n.oid = src.relnamespace
    where con.contype = 'f' and n.nspname = 'public' and src.relname like 'legal\\_%'
      -- FKs para auth.users não são navegáveis pela API.
      and ref.relnamespace = n.oid
    order by src.relname, con.conname`);
  const result: Record<string, Relationship[]> = {};
  for (const { table, ...relationship } of rows) {
    (result[table] ??= []).push(relationship);
  }
  return result;
}

type DbFunction = {
  name: string;
  args: { name: string; type: string }[];
  returnType: string;
  returnsSet: boolean;
};

async function loadFunctions(db: PGlite): Promise<DbFunction[]> {
  // Somente funções expostas a usuários autenticados (RPC); triggers ficam de fora.
  const { rows } = await db.query<{
    name: string;
    argNames: string[] | null;
    argTypes: string[];
    returnType: string;
    returnsSet: boolean;
  }>(`
    select p.proname as name, p.proargnames as "argNames",
      array(select t.typname from unnest(p.proargtypes) with ordinality a(oid, i)
            join pg_type t on t.oid = a.oid order by a.i) as "argTypes",
      rt.typname as "returnType", p.proretset as "returnsSet"
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_type rt on rt.oid = p.prorettype
    where n.nspname = 'public' and p.proname like 'legal\\_%'
      and rt.typname <> 'trigger'
      and has_function_privilege('authenticated', p.oid, 'execute')
    order by p.proname`);
  return rows.map((row) => ({
    name: row.name,
    args: row.argTypes.map((type, index) => ({
      name: row.argNames?.[index] ?? `arg${index}`,
      type,
    })),
    returnType: row.returnType,
    returnsSet: row.returnsSet,
  }));
}
