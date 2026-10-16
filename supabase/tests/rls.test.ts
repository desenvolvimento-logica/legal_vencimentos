import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import {
  applyMigrations,
  asUser,
  createTestDb,
  expectDbError,
  microsoftClaims,
  passwordClaims,
  runAs,
  setSession,
} from "./test-db";

// Usuários Auth (fixos para tornar os cenários legíveis).
const U = {
  admin: "00000000-0000-4000-8000-000000000001",
  director: "00000000-0000-4000-8000-000000000002",
  coordinator: "00000000-0000-4000-8000-000000000003",
  leader: "00000000-0000-4000-8000-000000000004",
  userA: "00000000-0000-4000-8000-000000000005",
  userB: "00000000-0000-4000-8000-000000000006",
  inactive: "00000000-0000-4000-8000-000000000007",
} as const;

// Perfis.
const P = {
  director: "10000000-0000-4000-8000-000000000002",
  coordinator: "10000000-0000-4000-8000-000000000003",
  leader: "10000000-0000-4000-8000-000000000004",
  userA: "10000000-0000-4000-8000-000000000005",
  userB: "10000000-0000-4000-8000-000000000006",
  inactive: "10000000-0000-4000-8000-000000000007",
} as const;

// Clientes.
const C = {
  ofA: "20000000-0000-4000-8000-00000000000a",
  ofB: "20000000-0000-4000-8000-00000000000b",
  ofInactive: "20000000-0000-4000-8000-00000000000c",
  withoutResponsible: "20000000-0000-4000-8000-00000000000d",
  // Legalização (5) com A e Certificado Digital (13) com B.
  shared: "20000000-0000-4000-8000-00000000000e",
  // Só o subdepartamento 13, com B.
  certificateOfB: "20000000-0000-4000-8000-00000000000f",
  // Empresa inativa no Acessórias, com A como responsável: ninguém vê (legal_015).
  deactivatedOfA: "20000000-0000-4000-8000-000000000010",
} as const;

const ALL_CLIENTS = Object.values(C).filter((id) => id !== C.deactivatedOfA);

let db: PGlite;
let expirationOfA: string;
let expirationOfB: string;

async function visibleClients(tx: Transaction): Promise<string[]> {
  const { rows } = await tx.query<{ id: string }>(
    "select id from public.legal_clients order by id",
  );
  return rows.map((row) => row.id);
}

async function insertExpiration(
  tx: Transaction,
  clientId: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const values = {
    client_id: clientId,
    expiration_type: "CERTIDAO",
    document_name: "CND Federal",
    expiration_date: "2026-12-31",
    ...extra,
  };
  const columns = Object.keys(values);
  const params = columns.map((_, index) => `$${index + 1}`);
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.legal_expirations (${columns.join(", ")})
     values (${params.join(", ")}) returning id`,
    Object.values(values),
  );
  return rows[0].id;
}

beforeAll(async () => {
  db = await createTestDb();

  await db.exec(`
    insert into auth.users (id, email) values
      ('${U.admin}', 'Desenvolvimento@EscritorioLogica.com.br '),
      ('${U.director}', 'diretor@teste.local'),
      ('${U.coordinator}', 'coordenador@teste.local'),
      ('${U.leader}', 'lider@teste.local'),
      ('${U.userA}', 'a@teste.local'),
      ('${U.userB}', 'b@teste.local'),
      ('${U.inactive}', 'inativo@teste.local');
  `);

  // Aplicar duas vezes comprova que as migrations são idempotentes.
  await applyMigrations(db);
  await applyMigrations(db);

  await db.exec(`
    insert into public.legal_profiles (id, user_id, name, email, hierarchy_level, manager_id, active) values
      ('${P.director}', '${U.director}', 'Diretor', 'diretor@teste.local', 'DIRECTOR', null, true),
      ('${P.coordinator}', '${U.coordinator}', 'Coordenador', 'coordenador@teste.local', 'COORDINATOR', null, true),
      ('${P.leader}', '${U.leader}', 'Líder', 'lider@teste.local', 'LEADER', '${P.coordinator}', true),
      ('${P.userA}', '${U.userA}', 'Usuário A', 'a@teste.local', 'USER', '${P.leader}', true),
      ('${P.userB}', '${U.userB}', 'Usuário B', 'b@teste.local', 'USER', null, true),
      ('${P.inactive}', '${U.inactive}', 'Inativo', 'inativo@teste.local', 'USER', '${P.leader}', false);

    insert into public.legal_clients (id, acessorias_company_id, corporate_name, status, synced_at) values
      ('${C.ofA}', 'EMP-A', 'Cliente A', 'Ativa', now()),
      ('${C.ofB}', 'EMP-B', 'Cliente B', 'Ativa', now()),
      ('${C.ofInactive}', 'EMP-I', 'Cliente do perfil inativo', 'Ativa', now()),
      ('${C.withoutResponsible}', 'EMP-N', 'Cliente sem responsável', 'Ativa', now()),
      ('${C.shared}', 'EMP-S', 'Cliente compartilhado', 'Ativa', now()),
      ('${C.certificateOfB}', 'EMP-C', 'Cliente de certificado', 'Ativa', now()),
      ('${C.deactivatedOfA}', 'EMP-D', 'Empresa inativa', 'Inativa', now());

    -- A carteira vem dos responsáveis por departamento (legal_011).
    insert into public.legal_client_responsibles (client_id, department_id, responsible_email, synced_at) values
      ('${C.ofA}', '5', 'a@teste.local', now()),
      ('${C.ofB}', '5', 'b@teste.local', now()),
      ('${C.ofInactive}', '5', 'inativo@teste.local', now()),
      ('${C.shared}', '5', 'a@teste.local', now()),
      ('${C.shared}', '13', 'b@teste.local', now()),
      ('${C.certificateOfB}', '13', 'b@teste.local', now()),
      ('${C.deactivatedOfA}', '5', 'a@teste.local', now());

    insert into public.legal_acessorias_requests (acessorias_request_id, acessorias_company_id, subject, synced_at) values
      ('SOL-A', 'EMP-A', 'Solicitação do cliente A', now()),
      ('SOL-B', 'EMP-B', 'Solicitação do cliente B', now());
  `);

  // Vencimentos são criados pelos próprios usuários (autoria vem da sessão).
  for (const [userId, clientId, assign] of [
    [U.userA, C.ofA, (id: string) => (expirationOfA = id)],
    [U.userB, C.ofB, (id: string) => (expirationOfB = id)],
  ] as const) {
    await db.transaction(async (tx) => {
      await setSession(tx, "authenticated", microsoftClaims(userId));
      assign(await insertExpiration(tx, clientId));
    });
  }
});

describe("migrations", () => {
  it("provisionam o ADMIN inicial com e-mail normalizado", async () => {
    const { rows } = await db.query<{
      email: string;
      hierarchy_level: string;
      is_admin: boolean;
    }>(
      `select email, hierarchy_level, is_admin from public.legal_profiles where user_id = $1`,
      [U.admin],
    );
    expect(rows).toEqual([
      {
        email: "desenvolvimento@escritoriologica.com.br",
        hierarchy_level: "ADMIN",
        is_admin: true,
      },
    ]);
  });

  it("habilitam RLS em todas as tabelas legal_", async () => {
    const { rows } = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'legal\\_%'
         and not c.relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });

  it("criam as chaves iniciais de configuração", async () => {
    const { rows } = await db.query(
      "select key from public.legal_settings order by key",
    );
    expect(rows).toHaveLength(7);
  });
});

describe("anon", () => {
  it("não tem acesso a nenhuma tabela legal_", async () => {
    for (const table of [
      "legal_profiles",
      "legal_clients",
      "legal_expirations",
      "legal_acessorias_requests",
      "legal_audit_logs",
    ]) {
      const message = await runAs(db, "anon", { role: "anon" }, (tx) =>
        expectDbError(tx.query(`select 1 from public.${table}`)),
      );
      expect(message).toMatch(/permission denied/);
    }
  });

  it("não executa funções legal_", async () => {
    const message = await runAs(db, "anon", { role: "anon" }, (tx) =>
      expectDbError(tx.query("select public.legal_is_admin()")),
    );
    expect(message).toMatch(/permission denied/);
  });
});

describe("somente sessões Microsoft", () => {
  it("sessão por e-mail/senha do ADMIN não acessa nada", async () => {
    const result = await runAs(
      db,
      "authenticated",
      passwordClaims(U.admin),
      async (tx) => {
        const clients = await visibleClients(tx);
        const { rows } = await tx.query<{
          is_admin: boolean;
          id: string | null;
        }>(
          "select public.legal_is_admin() as is_admin, public.legal_current_profile_id() as id",
        );
        const { rows: profiles } = await tx.query(
          "select id from public.legal_profiles",
        );
        return { clients, ...rows[0], profiles: profiles.length };
      },
    );
    expect(result).toEqual({
      clients: [],
      is_admin: false,
      id: null,
      profiles: 0,
    });
  });

  it("sessão por senha não cria vencimentos", async () => {
    const message = await runAs(
      db,
      "authenticated",
      passwordClaims(U.userA),
      (tx) => expectDbError(insertExpiration(tx, C.ofA)),
    );
    expect(message).toMatch(/ACCESS DENIED|row-level security/);
  });

  it("OAuth sem identidade azure não é reconhecido", async () => {
    const claims = {
      ...microsoftClaims(U.admin),
      app_metadata: { provider: "google", providers: ["google"] },
    };
    const clients = await runAs(db, "authenticated", claims, visibleClients);
    expect(clients).toEqual([]);
  });

  it("JWT sem amr não é reconhecido", async () => {
    const claims = microsoftClaims(U.admin);
    delete claims.amr;
    const clients = await runAs(db, "authenticated", claims, visibleClients);
    expect(clients).toEqual([]);
  });
});

describe("escopo de clientes por hierarquia", () => {
  it.each([
    ["USER A vê somente a própria carteira", U.userA, [C.ofA, C.shared]],
    [
      "USER B vê a carteira nos departamentos 5 e 13",
      U.userB,
      [C.ofB, C.shared, C.certificateOfB],
    ],
    [
      "LEADER vê seus USER diretos, inclusive inativos",
      U.leader,
      [C.ofA, C.ofInactive, C.shared],
    ],
    [
      "COORDINATOR vê a árvore abaixo",
      U.coordinator,
      [C.ofA, C.ofInactive, C.shared],
    ],
    ["DIRECTOR vê todos, inclusive sem responsável", U.director, ALL_CLIENTS],
    ["ADMIN vê todos", U.admin, ALL_CLIENTS],
    ["perfil inativo não vê nada", U.inactive, []],
  ])("%s", async (_, userId, expected) => {
    const visible = await asUser(db, userId, visibleClients);
    expect(visible).toEqual([...expected].sort());
  });

  it("empresa inativa no Acessórias não aparece nem para o ADMIN", async () => {
    for (const userId of [U.userA, U.admin, U.director]) {
      const visible = await asUser(db, userId, visibleClients);
      expect(visible).not.toContain(C.deactivatedOfA);
    }
    const canAccess = await asUser(db, U.userA, async (tx) => {
      const { rows } = await tx.query<{ ok: boolean }>(
        "select public.legal_can_access_client($1) as ok",
        [C.deactivatedOfA],
      );
      return rows[0].ok;
    });
    expect(canAccess).toBe(false);
  });

  it("legal_can_access_client respeita o escopo", async () => {
    const result = await asUser(db, U.userA, async (tx) => {
      const { rows } = await tx.query<{ own: boolean; other: boolean }>(
        `select public.legal_can_access_client($1) as own,
                public.legal_can_access_client($2) as other`,
        [C.ofA, C.ofB],
      );
      return rows[0];
    });
    expect(result).toEqual({ own: true, other: false });
  });

  it("responsáveis visíveis seguem o escopo do cliente", async () => {
    const rows = await asUser(db, U.userA, async (tx) => {
      const { rows } = await tx.query<{
        client_id: string;
        department_id: string;
      }>(
        `select client_id, department_id from public.legal_client_responsibles
         order by client_id, department_id`,
      );
      return rows;
    });
    // A vê os dois responsáveis do cliente compartilhado, inclusive o de B.
    expect(rows).toEqual(
      [
        { client_id: C.ofA, department_id: "5" },
        { client_id: C.shared, department_id: "13" },
        { client_id: C.shared, department_id: "5" },
      ].sort((x, y) =>
        (x.client_id + x.department_id).localeCompare(
          y.client_id + y.department_id,
        ),
      ),
    );
  });

  it("usuário não escreve responsáveis (só a sincronização)", async () => {
    const message = await asUser(db, U.admin, (tx) =>
      expectDbError(
        tx.query(
          `insert into public.legal_client_responsibles (client_id, department_id, responsible_email, synced_at)
           values ($1, '13', 'a@teste.local', now())`,
          [C.ofB],
        ),
      ),
    );
    expect(message).toMatch(/permission denied/);
  });
});

describe("vencimentos: acesso cruzado (USER A x USER B)", () => {
  it("A não vê o vencimento de B nem conhecendo o UUID", async () => {
    const rows = await asUser(db, U.userA, async (tx) => {
      const { rows } = await tx.query(
        "select id from public.legal_expirations where id = $1",
        [expirationOfB],
      );
      return rows;
    });
    expect(rows).toEqual([]);
  });

  it("A lista apenas os próprios vencimentos", async () => {
    const ids = await asUser(db, U.userA, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "select id from public.legal_expirations",
      );
      return rows.map((row) => row.id);
    });
    expect(ids).toEqual([expirationOfA]);
  });

  it("A não cria vencimento para cliente de B", async () => {
    const message = await asUser(db, U.userA, (tx) =>
      expectDbError(insertExpiration(tx, C.ofB)),
    );
    expect(message).toMatch(/row-level security/);
  });

  it("A não move o próprio vencimento para cliente de B", async () => {
    const message = await asUser(db, U.userA, (tx) =>
      expectDbError(
        tx.query(
          "update public.legal_expirations set client_id = $1 where id = $2",
          [C.ofB, expirationOfA],
        ),
      ),
    );
    // Desde legal_016 o cliente é imutável (o trigger recusa antes do RLS).
    expect(message).toMatch(/imutáveis|row-level security/);
  });

  it("A não altera vencimento de B (nenhuma linha afetada)", async () => {
    const affected = await asUser(db, U.userA, async (tx) => {
      const result = await tx.query(
        "update public.legal_expirations set notes = 'invasão' where id = $1",
        [expirationOfB],
      );
      return result.affectedRows;
    });
    expect(affected).toBe(0);
  });

  it("autoria forjada é substituída pela sessão", async () => {
    const createdBy = await asUser(db, U.userA, async (tx) => {
      const id = await insertExpiration(tx, C.ofA, {
        created_by: P.userB,
        updated_by: P.userB,
      });
      const { rows } = await tx.query<{ created_by: string }>(
        "select created_by from public.legal_expirations where id = $1",
        [id],
      );
      return rows[0].created_by;
    });
    expect(createdBy).toBe(P.userA);
  });

  it("DELETE físico é negado", async () => {
    const message = await asUser(db, U.userA, (tx) =>
      expectDbError(
        tx.query("delete from public.legal_expirations where id = $1", [
          expirationOfA,
        ]),
      ),
    );
    expect(message).toMatch(/permission denied/);
  });

  it("perfil inativo com sessão válida não cria vencimentos", async () => {
    const message = await asUser(db, U.inactive, (tx) =>
      expectDbError(insertExpiration(tx, C.ofInactive)),
    );
    expect(message).toMatch(/ACCESS DENIED|row-level security/);
  });
});

describe("vencimentos: integridade da renovação", () => {
  it("novo vencimento não pode nascer RENEWED nem apontar para anterior", async () => {
    const asRenewed = await asUser(db, U.userA, (tx) =>
      expectDbError(insertExpiration(tx, C.ofA, { status: "RENEWING" })),
    );
    expect(asRenewed).toMatch(/iniciar como ACTIVE/);

    const withPrevious = await asUser(db, U.userA, (tx) =>
      expectDbError(
        insertExpiration(tx, C.ofA, { previous_expiration_id: expirationOfA }),
      ),
    );
    expect(withPrevious).toMatch(/legal_complete_renewal/);
  });

  it("não marca RENEWED por UPDATE direto", async () => {
    const message = await asUser(db, U.userA, (tx) =>
      expectDbError(
        tx.query(
          "update public.legal_expirations set status = 'RENEWED', renewed_at = now() where id = $1",
          [expirationOfA],
        ),
      ),
    );
    expect(message).toMatch(/legal_complete_renewal/);
  });

  it("conclui a renovação atomicamente e preserva o histórico", async () => {
    const outcome = await asUser(db, U.userA, async (tx) => {
      await tx.query(
        "update public.legal_expirations set status = 'RENEWING' where id = $1",
        [expirationOfA],
      );
      const { rows: created } = await tx.query<{
        id: string;
        status: string;
        previous_expiration_id: string;
        expiration_date: Date;
        document_name: string;
        created_by: string;
      }>("select * from public.legal_complete_renewal($1, $2::jsonb)", [
        expirationOfA,
        JSON.stringify({ expiration_date: "2027-12-31" }),
      ]);
      const { rows: old } = await tx.query<{
        status: string;
        expiration_date: Date;
        renewed_at: Date | null;
      }>(
        "select status, expiration_date, renewed_at from public.legal_expirations where id = $1",
        [expirationOfA],
      );
      const repeated = await expectDbError(
        tx.query("select public.legal_complete_renewal($1, $2::jsonb)", [
          expirationOfA,
          JSON.stringify({ expiration_date: "2028-12-31" }),
        ]),
      );
      return { created: created[0], old: old[0], repeated };
    });

    expect(outcome.created).toMatchObject({
      status: "ACTIVE",
      previous_expiration_id: expirationOfA,
      document_name: "CND Federal",
      created_by: P.userA,
    });
    expect(outcome.created.expiration_date.toISOString()).toMatch(
      /^2027-12-31/,
    );
    expect(outcome.old.status).toBe("RENEWED");
    expect(outcome.old.renewed_at).not.toBeNull();
    // A data do registro anterior nunca é alterada pela renovação.
    expect(outcome.old.expiration_date.toISOString()).toMatch(/^2026-12-31/);
    expect(outcome.repeated).toMatch(/precisa estar em renovação/);
  });

  it("vencimento RENEWED não pode ser editado", async () => {
    const message = await asUser(db, U.userA, async (tx) => {
      await tx.query(
        "update public.legal_expirations set status = 'RENEWING' where id = $1",
        [expirationOfA],
      );
      await tx.query("select public.legal_complete_renewal($1, $2::jsonb)", [
        expirationOfA,
        JSON.stringify({ expiration_date: "2027-12-31" }),
      ]);
      return expectDbError(
        tx.query(
          "update public.legal_expirations set expiration_date = '2030-01-01' where id = $1",
          [expirationOfA],
        ),
      );
    });
    expect(message).toMatch(/não pode ser alterado/);
  });

  it("B não conclui a renovação de vencimento de A", async () => {
    const message = await asUser(db, U.userB, (tx) =>
      expectDbError(
        tx.query("select public.legal_complete_renewal($1, $2::jsonb)", [
          expirationOfA,
          JSON.stringify({ expiration_date: "2027-12-31" }),
        ]),
      ),
    );
    expect(message).toMatch(/não encontrado/);
  });

  it("rejeita payload sem nova data", async () => {
    const message = await asUser(db, U.userA, async (tx) => {
      await tx.query(
        "update public.legal_expirations set status = 'RENEWING' where id = $1",
        [expirationOfA],
      );
      return expectDbError(
        tx.query("select public.legal_complete_renewal($1, '{}'::jsonb)", [
          expirationOfA,
        ]),
      );
    });
    expect(message).toMatch(/obrigatória/);
  });
});

describe("legal_expiration_list (legal_017)", () => {
  it("lista só vencimentos de clientes visíveis, com busca por cliente", async () => {
    const result = await asUser(db, U.userA, async (tx) => {
      const { rows: all } = await tx.query<{ id: string }>(
        "select id from public.legal_expiration_list",
      );
      const { rows: found } = await tx.query<{ id: string }>(
        "select id from public.legal_expiration_list where search_text like '%' || $1 || '%'",
        ["cliente a"],
      );
      return { all: all.map((r) => r.id), found: found.map((r) => r.id) };
    });
    expect(result.all).toEqual([expirationOfA]);
    expect(result.found).toEqual([expirationOfA]);
  });

  it("não mostra vencimentos excluídos logicamente", async () => {
    const ids = await asUser(db, U.userA, async (tx) => {
      await tx.query("select public.legal_delete_expiration($1)", [
        expirationOfA,
      ]);
      const { rows } = await tx.query<{ id: string }>(
        "select id from public.legal_expiration_list",
      );
      return rows.map((row) => row.id);
    });
    expect(ids).toEqual([]);
  });

  it("anon não consulta a view", async () => {
    const message = await runAs(db, "anon", { role: "anon" }, (tx) =>
      expectDbError(tx.query("select 1 from public.legal_expiration_list")),
    );
    expect(message).toMatch(/permission denied/);
  });
});

describe("vencimentos: ciclo de vida (legal_016)", () => {
  const update = (tx: Transaction, sql: string) =>
    tx.query(`update public.legal_expirations set ${sql} where id = $1`, [
      expirationOfA,
    ]);

  it("desistir da renovação volta a ACTIVE e é auditado", async () => {
    const actions = await asUser(db, U.userA, async (tx) => {
      await update(tx, "status = 'RENEWING'");
      await update(tx, "status = 'ACTIVE'");
      await tx.exec("reset role");
      const { rows } = await tx.query<{ action: string }>(
        "select action from public.legal_audit_logs where entity_id = $1",
        [expirationOfA],
      );
      return rows.map((row) => row.action);
    });
    expect(actions).toContain("EXPIRATION_RENEWAL_ABANDONED");
  });

  it("cancelar exige motivo e torna o registro final", async () => {
    const withoutReason = await asUser(db, U.userA, (tx) =>
      expectDbError(update(tx, "status = 'CANCELLED'")),
    );
    expect(withoutReason).toMatch(/cancellation_reason_check/);

    const afterCancel = await asUser(db, U.userA, async (tx) => {
      await update(
        tx,
        "status = 'CANCELLED', cancellation_reason = 'Cliente encerrou a atividade'",
      );
      return expectDbError(update(tx, "notes = 'depois de cancelar'"));
    });
    expect(afterCancel).toMatch(/não pode ser alterado/);
  });

  it("pode cancelar durante a renovação", async () => {
    const status = await asUser(db, U.userA, async (tx) => {
      await update(tx, "status = 'RENEWING'");
      await update(
        tx,
        "status = 'CANCELLED', cancellation_reason = 'Desistência'",
      );
      const { rows } = await tx.query<{ status: string }>(
        "select status from public.legal_expirations where id = $1",
        [expirationOfA],
      );
      return rows[0].status;
    });
    expect(status).toBe("CANCELLED");
  });

  it("não grava EXPIRED nem RENEWED diretamente", async () => {
    const expired = await asUser(db, U.userA, (tx) =>
      expectDbError(update(tx, "status = 'EXPIRED'")),
    );
    expect(expired).toMatch(/não permitida: ACTIVE → EXPIRED/);
    const renewed = await asUser(db, U.userA, (tx) =>
      expectDbError(update(tx, "status = 'RENEWED', renewed_at = now()")),
    );
    expect(renewed).toMatch(/legal_complete_renewal/);
  });

  it("motivo só pode ser informado ao cancelar", async () => {
    const message = await asUser(db, U.userA, (tx) =>
      expectDbError(update(tx, "cancellation_reason = 'sem cancelar'")),
    );
    expect(message).toMatch(
      /cancellation_reason_check|só é informado ao cancelar/,
    );
  });

  it("corrige a data em ACTIVE, mas não durante a renovação", async () => {
    const corrected = await asUser(db, U.userA, async (tx) => {
      await update(tx, "expiration_date = '2027-03-31'");
      const { rows } = await tx.query<{ expiration_date: Date }>(
        "select expiration_date from public.legal_expirations where id = $1",
        [expirationOfA],
      );
      return rows[0].expiration_date.toISOString().slice(0, 10);
    });
    expect(corrected).toBe("2027-03-31");

    const duringRenewal = await asUser(db, U.userA, async (tx) => {
      await update(tx, "status = 'RENEWING'");
      return expectDbError(update(tx, "expiration_date = '2027-03-31'"));
    });
    expect(duringRenewal).toMatch(/só pode ser corrigida em registros ativos/);
  });
});

describe("vencimentos: responsável (legal_016)", () => {
  const setResponsible = (
    tx: Transaction,
    expirationId: string,
    profileId: string,
  ) =>
    tx.query(
      "update public.legal_expirations set responsible_user_id = $2 where id = $1",
      [expirationId, profileId],
    );

  it("aceita o próprio perfil e recusa perfil fora do escopo", async () => {
    await asUser(db, U.userA, (tx) =>
      setResponsible(tx, expirationOfA, P.userA),
    );
    const message = await asUser(db, U.userA, (tx) =>
      expectDbError(setResponsible(tx, expirationOfA, P.userB)),
    );
    expect(message).toMatch(/fora do escopo/);
  });

  it("aceita o responsável do cliente no Acessórias, mesmo fora do escopo", async () => {
    // B é responsável (depto 13) do cliente compartilhado; A pode atribuí-lo.
    const responsible = await asUser(db, U.userA, async (tx) => {
      const id = await insertExpiration(tx, C.shared, {
        responsible_user_id: P.userB,
      });
      const { rows } = await tx.query<{ responsible_user_id: string }>(
        "select responsible_user_id from public.legal_expirations where id = $1",
        [id],
      );
      return rows[0].responsible_user_id;
    });
    expect(responsible).toBe(P.userB);
  });

  it("gestor atribui subordinado; ninguém atribui perfil inativo", async () => {
    await asUser(db, U.leader, (tx) =>
      setResponsible(tx, expirationOfA, P.userA),
    );
    const message = await asUser(db, U.leader, (tx) =>
      expectDbError(setResponsible(tx, expirationOfA, P.inactive)),
    );
    expect(message).toMatch(/fora do escopo/);
  });

  it("insere com responsável forjado fora do escopo: recusado", async () => {
    const message = await asUser(db, U.userA, (tx) =>
      expectDbError(
        insertExpiration(tx, C.ofA, { responsible_user_id: P.director }),
      ),
    );
    expect(message).toMatch(/fora do escopo/);
  });

  it("legal_visible_profiles expõe só perfis relevantes ao usuário", async () => {
    const ids = await asUser(db, U.userA, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "select id from public.legal_visible_profiles() order by id",
      );
      return rows.map((row) => row.id);
    });
    // A, e B por ser responsável do cliente compartilhado; nunca diretor ou líder.
    expect(ids).toEqual([P.userA, P.userB].sort());
  });
});

describe("vencimentos: exclusão lógica (legal_016)", () => {
  it("exclui logicamente, some das consultas e fica na auditoria", async () => {
    const result = await asUser(db, U.userA, async (tx) => {
      await tx.query("select public.legal_delete_expiration($1)", [
        expirationOfA,
      ]);
      const { rows: visible } = await tx.query(
        "select id from public.legal_expirations where id = $1",
        [expirationOfA],
      );
      await tx.exec("reset role");
      const { rows: stored } = await tx.query<{ deleted_at: Date | null }>(
        "select deleted_at from public.legal_expirations where id = $1",
        [expirationOfA],
      );
      const { rows: audit } = await tx.query(
        "select 1 from public.legal_audit_logs where entity_id = $1 and action = 'EXPIRATION_DELETED'",
        [expirationOfA],
      );
      return {
        visible: visible.length,
        deletedAt: stored[0].deleted_at,
        audit: audit.length,
      };
    });
    expect(result.visible).toBe(0);
    expect(result.deletedAt).not.toBeNull();
    expect(result.audit).toBe(1);
  });

  it("não exclui vencimento de outro usuário", async () => {
    const message = await asUser(db, U.userA, (tx) =>
      expectDbError(
        tx.query("select public.legal_delete_expiration($1)", [expirationOfB]),
      ),
    );
    expect(message).toMatch(/não encontrado/);
  });

  it("não exclui por UPDATE direto de deleted_at", async () => {
    const message = await asUser(db, U.userA, (tx) =>
      expectDbError(
        tx.query(
          "update public.legal_expirations set deleted_at = now() where id = $1",
          [expirationOfA],
        ),
      ),
    );
    expect(message).toMatch(/legal_delete_expiration|row-level security/);
  });

  it("não exclui vencimento que faz parte de cadeia de renovação", async () => {
    const message = await asUser(db, U.userA, async (tx) => {
      await tx.query(
        "update public.legal_expirations set status = 'RENEWING' where id = $1",
        [expirationOfA],
      );
      await tx.query("select public.legal_complete_renewal($1, $2::jsonb)", [
        expirationOfA,
        JSON.stringify({ expiration_date: "2027-12-31" }),
      ]);
      return expectDbError(
        tx.query("select public.legal_delete_expiration($1)", [expirationOfA]),
      );
    });
    expect(message).toMatch(/cadeia de renovação/);
  });
});

describe("auditoria", () => {
  it("registra criação e renovação com autor da sessão", async () => {
    const actions = await asUser(db, U.userA, async (tx) => {
      await tx.query(
        "update public.legal_expirations set status = 'RENEWING' where id = $1",
        [expirationOfA],
      );
      await tx.query("select public.legal_complete_renewal($1, $2::jsonb)", [
        expirationOfA,
        JSON.stringify({ expiration_date: "2027-12-31" }),
      ]);
      // Leitura como postgres dentro da mesma transação (auditoria é só ADMIN).
      await tx.exec("reset role");
      const { rows } = await tx.query<{ action: string; user_id: string }>(
        `select action, user_id from public.legal_audit_logs
         where entity_id = $1 or new_data ->> 'previous_expiration_id' = $1::text
         order by created_at, action`,
        [expirationOfA],
      );
      return rows;
    });
    expect(actions.map((row) => row.action).sort()).toEqual(
      [
        "EXPIRATION_CREATED",
        "EXPIRATION_RENEWAL_CREATED",
        "EXPIRATION_RENEWAL_STARTED",
        "EXPIRATION_RENEWED",
      ].sort(),
    );
    expect(new Set(actions.map((row) => row.user_id))).toEqual(
      new Set([P.userA]),
    );
  });

  it("USER não lê auditoria; ADMIN lê", async () => {
    const forUser = await asUser(db, U.userA, async (tx) => {
      const { rows } = await tx.query("select id from public.legal_audit_logs");
      return rows.length;
    });
    const forAdmin = await asUser(db, U.admin, async (tx) => {
      const { rows } = await tx.query("select id from public.legal_audit_logs");
      return rows.length;
    });
    expect(forUser).toBe(0);
    expect(forAdmin).toBeGreaterThan(0);
  });

  it("usuário não grava auditoria diretamente", async () => {
    const message = await asUser(db, U.admin, (tx) =>
      expectDbError(
        tx.query(
          `insert into public.legal_audit_logs (user_id, action, entity_type, entity_id)
           values ($1, 'FAKE', 'x', $1)`,
          [P.userA],
        ),
      ),
    );
    expect(message).toMatch(/permission denied/);
  });
});

describe("solicitações, perfis e configurações", () => {
  it("solicitações seguem o escopo do cliente", async () => {
    const subjects = await asUser(db, U.userA, async (tx) => {
      const { rows } = await tx.query<{ acessorias_request_id: string }>(
        "select acessorias_request_id from public.legal_acessorias_requests",
      );
      return rows.map((row) => row.acessorias_request_id);
    });
    expect(subjects).toEqual(["SOL-A"]);
  });

  it("USER lê apenas o próprio perfil e não é admin", async () => {
    const result = await asUser(db, U.userA, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "select id from public.legal_profiles",
      );
      const { rows: admin } = await tx.query<{ is_admin: boolean }>(
        "select public.legal_is_admin() as is_admin",
      );
      return { ids: rows.map((row) => row.id), isAdmin: admin[0].is_admin };
    });
    expect(result).toEqual({ ids: [P.userA], isAdmin: false });
  });

  it("USER não altera o próprio perfil para ADMIN", async () => {
    const message = await asUser(db, U.userA, (tx) =>
      expectDbError(
        tx.query(
          "update public.legal_profiles set hierarchy_level = 'ADMIN', is_admin = true where user_id = $1",
          [U.userA],
        ),
      ),
    );
    expect(message).toMatch(/permission denied/);
  });

  it("configurações e logs de sincronização são só do ADMIN", async () => {
    const count = async (userId: string) =>
      asUser(db, userId, async (tx) => {
        const { rows } = await tx.query(
          "select key from public.legal_settings",
        );
        return rows.length;
      });
    expect(await count(U.userA)).toBe(0);
    expect(await count(U.director)).toBe(0);
    expect(await count(U.admin)).toBe(7);
  });

  it("service_role escreve no cache de clientes (sincronização)", async () => {
    const inserted = await runAs(
      db,
      "service_role",
      { role: "service_role" },
      async (tx) => {
        const result = await tx.query(
          `insert into public.legal_clients (acessorias_company_id, corporate_name, synced_at)
         values ('EMP-NOVA', 'Nova', now())`,
        );
        return result.affectedRows;
      },
    );
    expect(inserted).toBe(1);
  });
});

describe("legal_client_overview", () => {
  it("respeita o escopo do usuário (security_invoker)", async () => {
    const ids = await asUser(db, U.userA, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "select id from public.legal_client_overview order by id",
      );
      return rows.map((row) => row.id);
    });
    expect(ids).toEqual([C.ofA, C.shared].sort());
  });

  it("agrega os vencimentos visíveis e busca CNPJ só por dígitos", async () => {
    const row = await asUser(db, U.userA, async (tx) => {
      // Ajuste de dados como postgres; a consulta volta a ser do usuário A.
      await tx.exec("reset role");
      await tx.query(
        "update public.legal_clients set document_number = '11.222.333/0001-81' where id = $1",
        [C.ofA],
      );
      await setSession(tx, "authenticated", microsoftClaims(U.userA));
      const { rows } = await tx.query<{
        active_expirations: number;
        overdue_expirations: number;
      }>(
        `select active_expirations, overdue_expirations
         from public.legal_client_overview
         where document_digits like '%' || $1 || '%'`,
        ["11222333"],
      );
      return rows;
    });
    // O cliente A tem um vencimento ativo (criado no beforeAll).
    expect(row).toEqual([{ active_expirations: 1, overdue_expirations: 0 }]);
  });

  it("anon não consulta a view", async () => {
    const message = await runAs(db, "anon", { role: "anon" }, (tx) =>
      expectDbError(tx.query("select 1 from public.legal_client_overview")),
    );
    expect(message).toMatch(/permission denied/);
  });
});

describe("sincronização", () => {
  it("permite só uma execução RUNNING por integração e tipo", async () => {
    const message = await runAs(
      db,
      "service_role",
      { role: "service_role" },
      async (tx) => {
        const insert = (type: string) =>
          tx.query(
            `insert into public.legal_sync_logs (integration, sync_type, started_at, status)
             values ('acessorias', $1, now(), 'RUNNING')`,
            [type],
          );
        await insert("companies");
        await insert("users"); // outro tipo pode rodar em paralelo
        return expectDbError(insert("companies"));
      },
    );
    expect(message).toMatch(/legal_sync_logs_one_running_idx/);
  });
});

describe("validação da hierarquia", () => {
  const rejects = async (sql: string) =>
    expectDbError(
      db.transaction(async (tx) => {
        await tx.exec(sql);
      }),
    );

  it("rejeita autogestão", async () => {
    expect(
      await rejects(
        `update public.legal_profiles set manager_id = id where id = '${P.userB}'`,
      ),
    ).toMatch(/manager_not_self|acima/);
  });

  it("rejeita gestor de nível igual ou inferior", async () => {
    expect(
      await rejects(
        `update public.legal_profiles set manager_id = '${P.userA}' where id = '${P.userB}'`,
      ),
    ).toMatch(/acima do subordinado/);
  });

  it("rejeita gestor inativo", async () => {
    expect(
      await rejects(
        `update public.legal_profiles set hierarchy_level = 'LEADER', manager_id = '${P.coordinator}' where id = '${P.inactive}';
         update public.legal_profiles set manager_id = '${P.inactive}' where id = '${P.userB}'`,
      ),
    ).toMatch(/inativo/);
  });

  it("rejeita rebaixar gestor abaixo dos subordinados", async () => {
    expect(
      await rejects(
        `update public.legal_profiles set hierarchy_level = 'USER' where id = '${P.leader}'`,
      ),
    ).toMatch(/incompatível com os subordinados/);
  });

  it("rejeita ADMIN na árvore operacional", async () => {
    expect(
      await rejects(
        `update public.legal_profiles set manager_id = '${P.director}' where user_id = '${U.admin}'`,
      ),
    ).toMatch(/ADMIN/);
  });

  it("rejeita is_admin inconsistente com o nível", async () => {
    expect(
      await rejects(
        `update public.legal_profiles set is_admin = true where id = '${P.userB}'`,
      ),
    ).toMatch(/admin_consistent/);
  });
});
