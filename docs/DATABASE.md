# Banco de dados

## 1. Ambiente e limites

Usar exclusivamente o Supabase corporativo:

```text
URL: https://olyvjnqmrzkziirzbmhi.supabase.co
Project ref: olyvjnqmrzkziirzbmhi
```

O projeto é compartilhado. Antes de toda migration, inspecionar schema, tabelas, tipos, funções, triggers e policies existentes. Nunca resetar banco/Auth, apagar objetos existentes, modificar tabelas de outro sistema, remover policies alheias ou alterar configuração global sem análise.

Todos os objetos próprios usam `legal_` no schema `public`. Edge Functions, se adotadas, usam `legal-`. Decisão confirmada pelo responsável em 15/10/2026: o prefixo identifica o sistema dentro do projeto compartilhado; não criar schema próprio (exigiria alterar os Exposed schemas globais).

Existe apenas o ambiente de produção. O agente não acessa o banco diretamente: escreve as consultas de inspeção e as migrations, e o responsável as executa e devolve o resultado.

## 2. Convenções

- UUID: `gen_random_uuid()` como default para chaves internas.
- Datas civis: `DATE`.
- Instantes: `TIMESTAMPTZ`, gravados em UTC e exibidos em `America/Sao_Paulo`.
- `created_at`: `NOT NULL DEFAULT now()`.
- `updated_at`: `NOT NULL DEFAULT now()`, mantido por trigger `legal_set_updated_at()`.
- Exclusão de vencimento: lógica por `deleted_at`; consultas normais incluem `deleted_at IS NULL`.
- E-mails usados em comparação devem ser normalizados com trim e lowercase na sincronização e nas funções de escopo.
- Objetos operacionais têm RLS habilitada e policies explícitas.

## 3. Enums

### `legal_hierarchy_level`

```text
USER
LEADER
COORDINATOR
MANAGER
DIRECTOR
ADMIN
```

### `legal_expiration_type`

```text
CERTIDAO
LICENCA
CERTIFICADO
```

### `legal_expiration_status`

```text
ACTIVE
RENEWING
RENEWED
EXPIRED
CANCELLED
```

### `legal_sync_status`

```text
RUNNING
SUCCESS
PARTIAL
FAILED
```

## 4. Tabelas

### `legal_profiles`

Perfis autorizados a usar a aplicação. Não confundir com usuários importados do Acessórias.

| Coluna | Tipo e restrições |
| --- | --- |
| `id` | UUID PK, default `gen_random_uuid()` |
| `user_id` | UUID NOT NULL UNIQUE, FK `auth.users(id)` |
| `name` | TEXT NOT NULL |
| `email` | TEXT NOT NULL UNIQUE |
| `job_title` | TEXT NULL |
| `hierarchy_level` | `legal_hierarchy_level` NOT NULL DEFAULT `USER` |
| `manager_id` | UUID NULL, FK `legal_profiles(id)` com `ON DELETE RESTRICT` |
| `is_admin` | BOOLEAN NOT NULL DEFAULT false |
| `active` | BOOLEAN NOT NULL DEFAULT true |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() |

Restrições adicionais:

- `manager_id <> id`;
- e-mail normalizado;
- ciclo e compatibilidade de níveis validados por função/transação administrativa;
- autorização administrativa verdadeira quando `is_admin = true` ou `hierarchy_level = ADMIN`; manter ambos consistentes.

Índices: `user_id`, `lower(email)`, `manager_id`, `(active, hierarchy_level)`.

### `legal_clients`

Cache de empresas do Acessórias; não é cadastro mestre editável.

| Coluna | Tipo e restrições |
| --- | --- |
| `id` | UUID PK |
| `acessorias_company_id` | TEXT NOT NULL UNIQUE |
| `document_number` | TEXT NULL |
| `corporate_name` | TEXT NOT NULL |
| `trade_name` | TEXT NULL |
| `status` | TEXT NULL |
| `state` | TEXT NULL |
| `legalization_department_id` | TEXT NULL |
| `legalization_responsible_name` | TEXT NULL |
| `legalization_responsible_email` | TEXT NULL |
| `legalization_responsible_acessorias_user_id` | TEXT NULL |
| `acessorias_updated_at` | TIMESTAMPTZ NULL |
| `synced_at` | TIMESTAMPTZ NOT NULL |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() |

Índices obrigatórios: `acessorias_company_id`, `document_number`, `corporate_name`, `legalization_responsible_email`, `status`. Para busca textual, avaliar índices funcionais/trigram somente após validar extensões já disponíveis no projeto compartilhado.

### `legal_acessorias_users`

Cache dos usuários do Acessórias. Não concede acesso à aplicação.

| Coluna | Tipo e restrições |
| --- | --- |
| `id` | UUID PK |
| `acessorias_user_id` | TEXT NOT NULL UNIQUE |
| `name` | TEXT NULL |
| `email` | TEXT NULL |
| `status` | TEXT NULL |
| `synced_at` | TIMESTAMPTZ NOT NULL |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() |

Índices: `acessorias_user_id`, `lower(email)`, `status`.

### `legal_expirations`

| Coluna | Tipo e restrições |
| --- | --- |
| `id` | UUID PK |
| `client_id` | UUID NOT NULL, FK `legal_clients(id)` com `ON DELETE RESTRICT` |
| `expiration_type` | `legal_expiration_type` NOT NULL |
| `document_name` | TEXT NOT NULL |
| `document_number` | TEXT NULL |
| `issuer` | TEXT NULL |
| `issue_date` | DATE NULL |
| `expiration_date` | DATE NOT NULL |
| `responsible_user_id` | UUID NULL, FK `legal_profiles(id)` com `ON DELETE RESTRICT` |
| `status` | `legal_expiration_status` NOT NULL DEFAULT `ACTIVE` |
| `notes` | TEXT NULL |
| `previous_expiration_id` | UUID NULL, FK autorreferente com `ON DELETE RESTRICT` |
| `renewed_at` | TIMESTAMPTZ NULL; preenchido quando o registro passa a `RENEWED` (base do indicador “renovados no mês”) |
| `created_by` | UUID NOT NULL, FK `legal_profiles(id)` com `ON DELETE RESTRICT` |
| `updated_by` | UUID NOT NULL, FK `legal_profiles(id)` com `ON DELETE RESTRICT` |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() |
| `deleted_at` | TIMESTAMPTZ NULL |

A coluna `renewed_from_id` da SRS original não será criada: `previous_expiration_id` já representa a cadeia de renovação (decisão de 15/10/2026).

Restrições:

- `previous_expiration_id <> id`;
- `renewed_at` preenchido se e somente se `status = 'RENEWED'`;
- impedir ciclos na cadeia de renovação;
- definir limites de strings no schema Zod e, para campos críticos, também por `CHECK` no banco;
- não exigir `issue_date <= expiration_date` sem confirmação do negócio, pois a SRS não define essa regra.

Índices mínimos:

- `(client_id, expiration_date)` onde `deleted_at IS NULL`;
- `(status, expiration_date)` onde `deleted_at IS NULL`;
- `responsible_user_id` onde `deleted_at IS NULL`;
- `previous_expiration_id`;
- `created_by`.

Status visual calculado:

```sql
case
  when status = 'ACTIVE' and expiration_date < (now() at time zone 'America/Sao_Paulo')::date
    then 'EXPIRED'
  else status::text
end
```

### `legal_acessorias_requests`

Cache somente leitura das solicitações.

| Coluna | Tipo e restrições |
| --- | --- |
| `id` | UUID PK |
| `acessorias_request_id` | TEXT NOT NULL UNIQUE |
| `acessorias_company_id` | TEXT NULL |
| `company_document_number` | TEXT NULL |
| `company_name` | TEXT NULL |
| `request_type` | TEXT NULL |
| `subject` | TEXT NULL |
| `priority` | TEXT NULL |
| `status` | TEXT NULL |
| `requester_name` | TEXT NULL |
| `requester_id` | TEXT NULL |
| `department_id` | TEXT NULL |
| `department_name` | TEXT NULL |
| `office_responsibles` | JSONB NULL |
| `office_responsible_ids` | JSONB NULL |
| `opened_at` | TIMESTAMPTZ NULL |
| `due_at` | TIMESTAMPTZ NULL |
| `last_update_at` | TIMESTAMPTZ NULL |
| `completed_at` | TIMESTAMPTZ NULL |
| `synced_at` | TIMESTAMPTZ NOT NULL |

Índices: `acessorias_request_id`, `acessorias_company_id`, `company_document_number`, `status`, `department_id`, `due_at`, `last_update_at`.

### `legal_audit_logs`

Tabela append-only.

| Coluna | Tipo e restrições |
| --- | --- |
| `id` | UUID PK |
| `user_id` | UUID NOT NULL, FK `legal_profiles(id)` com `ON DELETE RESTRICT` |
| `action` | TEXT NOT NULL |
| `entity_type` | TEXT NOT NULL |
| `entity_id` | UUID NOT NULL |
| `old_data` | JSONB NULL |
| `new_data` | JSONB NULL |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() |

Índices: `(created_at DESC)`, `(user_id, created_at DESC)`, `(entity_type, entity_id)`, `(action, created_at DESC)`.

### `legal_sync_logs`

| Coluna | Tipo e restrições |
| --- | --- |
| `id` | UUID PK |
| `integration` | TEXT NOT NULL |
| `sync_type` | TEXT NOT NULL |
| `started_at` | TIMESTAMPTZ NOT NULL |
| `finished_at` | TIMESTAMPTZ NULL |
| `status` | `legal_sync_status` NOT NULL |
| `records_received` | INTEGER NOT NULL DEFAULT 0 |
| `records_created` | INTEGER NOT NULL DEFAULT 0 |
| `records_updated` | INTEGER NOT NULL DEFAULT 0 |
| `records_failed` | INTEGER NOT NULL DEFAULT 0 |
| `error_message` | TEXT NULL |
| `metadata` | JSONB NULL |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() |

Todos os contadores têm `CHECK (valor >= 0)`. Índices: `(integration, sync_type, started_at DESC)` e `(status, started_at DESC)`.

### `legal_settings`

Configuração não secreta. `key` é a chave primária natural.

| Coluna | Tipo e restrições |
| --- | --- |
| `key` | TEXT PK |
| `value` | JSONB NOT NULL |
| `description` | TEXT NULL |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() |

Chaves iniciais:

```text
acessorias_legalization_department_id
last_successful_company_sync
last_successful_user_sync
last_successful_request_sync
```

Nunca armazenar credenciais ou tokens nesta tabela.

## 5. Funções de banco

Criar, com `search_path` fixo e privilégios mínimos:

- `legal_current_profile()` — retorna o perfil ativo de `auth.uid()`;
- `legal_is_admin()` — consulta `is_admin`/nível no banco;
- `legal_get_user_scope()` — retorna IDs de perfis da árvore visível, incluindo o próprio perfil;
- `legal_can_access_client(client_uuid)` — resolve acesso pela carteira e hierarquia;
- `legal_complete_renewal(old_id, payload)` — conclui a renovação atomicamente;
- `legal_set_updated_at()` — mantém `updated_at`.

Funções `SECURITY DEFINER` precisam de owner controlado, `search_path` explícito, revogação de `PUBLIC` e `GRANT EXECUTE` somente aos papéis necessários. Evitar recursão de policies ao consultar `legal_profiles`.

## 6. Transação de renovação

`legal_complete_renewal` deve:

1. carregar e bloquear o vencimento anterior (`FOR UPDATE`);
2. verificar sessão, escopo, `deleted_at IS NULL` e estado `RENEWING`;
3. validar o payload do novo registro;
4. atualizar o anterior para `RENEWED`, `renewed_at = now()` e `updated_by`;
5. inserir o novo `ACTIVE` com `previous_expiration_id = old.id`;
6. gravar auditoria dos dois efeitos;
7. retornar o novo registro.

Tudo ocorre na mesma transação. Repetição da mesma requisição não pode criar dois sucessores; garantir isso por lock e regra/índice compatível com o modelo final.

## 7. Ordem das migrations

Os arquivos também usam o prefixo do sistema: `legal_NNN_descricao.sql`.

1. `legal_001_create_enums.sql`
2. `legal_002_create_profiles.sql`
3. `legal_003_create_clients_and_acessorias_users.sql`
4. `legal_004_create_expirations.sql`
5. `legal_005_create_requests_settings_and_logs.sql`
6. `legal_006_create_functions.sql`
7. `legal_007_create_rls.sql`
8. `legal_008_create_indexes.sql`
9. `legal_009_seed_admin_profile.sql` — somente se o `auth.users` correspondente existir; deve ser idempotente.
10. `legal_010_require_microsoft_session.sql` — exige sessão Microsoft nas funções de acesso.
11. `legal_011_client_responsibles.sql` — responsáveis por departamento (5 e 13) definem a carteira.
12. `legal_012_sync_lock.sql` — no máximo uma sincronização RUNNING por tipo.
13. `legal_013_client_overview.sql` — view `legal_client_overview` (security_invoker) com agregados para a tela de clientes.
14. `legal_014_ignored_responsibles.sql` — e-mails desconsiderados como responsáveis da Legalização (Evelin, Mariane e Monise; decisão de 15/10/2026). A sincronização remove esses responsáveis; a lista fica em `legal_settings.acessorias_ignored_responsible_emails`.
15. `legal_015_active_clients_only.sql` — somente empresas com status `Ativa` no Acessórias entram no escopo (todos os níveis). A sincronização continua trazendo as inativas para registrar mudanças de situação (decisão de 15/10/2026).
16. `legal_016_expiration_rules.sql` — ciclo de vida dos vencimentos (transições, motivo de cancelamento, correção de data, responsável válido, exclusão lógica por RPC e perfis visíveis). Detalhes em DEVELOPMENT.md, Fase 6.
17. `legal_017_expiration_list.sql` — view `legal_expiration_list` (security_invoker) com dados do cliente e `search_text` para a busca única da tela Vencimentos.

As migrations são aplicadas manualmente pelo responsável (SQL Editor), não por `supabase db push`, para não interferir no histórico de migrations dos outros sistemas. Toda migration deve ser idempotente quando seguro, pequena, revisável e acompanhada de caminho de rollback documentado. Não executar a migration contra o banco corporativo sem inspecionar o ambiente alvo.

## 8. Integridade e auditoria

- Operações críticas usam transação no servidor/banco.
- Alterações auditáveis gravam `old_data` e `new_data` sem secrets.
- Usuários comuns não podem atualizar ou apagar `legal_audit_logs`/`legal_sync_logs`.
- Dados importados usam upsert controlado e nunca removem vencimentos vinculados.
- O cursor de sincronização só muda no commit de uma execução `SUCCESS`.
- O estado `PARTIAL` conserva detalhes das falhas e não avança o cursor global.

## 9. Decisões de implementação (Fase 1)

Complementos às seções anteriores, implementados em `legal_006` e `legal_007`:

- **Funções auxiliares adicionais:** `legal_current_profile_id()`, `legal_has_global_scope()` (DIRECTOR/ADMIN) e `legal_scope_emails()`. As policies de `legal_clients` usam `legal_scope_emails()`. As de vencimentos e solicitações herdam o escopo por `exists` em `legal_clients`, cuja subconsulta também passa pelo RLS.
- **Autoria derivada da sessão:** o trigger `legal_expirations_before_write` sobrescreve `created_by`/`updated_by` com o perfil ativo e rejeita escrita sem perfil ativo. Também torna imutáveis `id`, `created_by`, `created_at` e `previous_expiration_id`.
- **Proteção da cadeia:** vencimento novo nasce `ACTIVE`. `RENEWED`, `renewed_at` e `previous_expiration_id` só são gravados dentro de `legal_complete_renewal`, por meio do contexto transacional `legal.renewal_context`, que não é alcançável pela API REST. Um vencimento `RENEWED` não pode mais ser editado. Um índice único parcial garante no máximo um sucessor. Ciclos são impossíveis: o anterior precisa existir antes do sucessor, e o vínculo é imutável.
- **Auditoria por trigger:** `legal_expirations_audit` (SECURITY DEFINER) grava toda inserção e alteração de vencimento. Ações: `EXPIRATION_CREATED`, `EXPIRATION_UPDATED`, `EXPIRATION_RESPONSIBLE_CHANGED`, `EXPIRATION_RENEWAL_STARTED`, `EXPIRATION_RENEWED`, `EXPIRATION_RENEWAL_CREATED`, `EXPIRATION_CANCELLED`, `EXPIRATION_STATUS_CHANGED` e `EXPIRATION_DELETED`. Usuários não têm privilégio de INSERT em `legal_audit_logs`.
- **Payload de `legal_complete_renewal(old_id, payload)`:** `expiration_date` é obrigatório. `issue_date`, `document_name`, `document_number`, `issuer` e `notes` são opcionais. Cliente, tipo e responsável são herdados do anterior. A função é SECURITY INVOKER, então o RLS do chamador limita o que pode ser renovado.
- **Hierarquia:** o trigger `legal_profiles_validate_hierarchy` aplica as regras de AUTHORIZATION.md §4. Escrita em `legal_profiles` pela API fica bloqueada até a Fase 8 (administração por RPC auditada).
- **Privilégios:** os privilégios padrão do Supabase para `anon`/`authenticated` são revogados. `authenticated` recebe SELECT, e só em `legal_expirations` também INSERT e UPDATE. DELETE nunca é concedido.
- **Somente sessões Microsoft (`legal_010`):** `legal_session_is_microsoft()` e `legal_auth_uid()` substituem `auth.uid()` nas funções de perfil e escopo e na policy de `legal_profiles`. Uma sessão por e-mail/senha do mesmo usuário não vê nem grava nada.
- **Exclusão lógica (Fase 6):** como a policy de SELECT exige `deleted_at IS NULL`, um UPDATE com `RETURNING` que preencha `deleted_at` seria rejeitado. A exclusão lógica deve ser feita por RPC dedicada.
