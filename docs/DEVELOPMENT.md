# Desenvolvimento e qualidade

## 1. Stack obrigatória

- Next.js com App Router
- React
- TypeScript com `strict: true`
- Tailwind CSS
- shadcn/ui
- Lucide Icons
- TanStack Query para server state
- React Hook Form para formulários
- Zod para validação nas fronteiras
- Supabase Auth e PostgreSQL/RLS

Não usar JavaScript sem tipagem. Estado simples de interface fica local; não introduzir store global sem necessidade comprovada.

## 2. Estrutura de referência

```text
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── clients/
│   │   ├── expirations/
│   │   └── admin/
│   └── api/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── clients/
│   ├── expirations/
│   ├── requests/
│   └── admin/
├── lib/
│   ├── supabase/
│   ├── acessorias/
│   ├── auth/
│   ├── permissions/
│   ├── validators/
│   └── utils/
├── services/
│   ├── clients/
│   ├── expirations/
│   ├── requests/
│   ├── users/
│   └── sync/
├── types/
└── config/

supabase/
└── migrations/

docs/
├── SRS.md
├── DATABASE.md
├── ACESSORIAS.md
├── AUTHORIZATION.md
└── DEVELOPMENT.md
```

A estrutura pode mudar com justificativa técnica, mantendo separação entre UI, domínio, banco, integrações, validação e autenticação.

## 3. Supabase clients

Separar explicitamente:

- browser client: chave publishable (papel `anon`), sessão do usuário e operações protegidas por RLS;
- server client: cookies/sessão da requisição e operações do usuário;
- service-role client: módulo `server-only`, importado apenas por sincronização/provisionamento que realmente precise ignorar RLS.

Adicionar barreira de importação para impedir que service role alcance Client Components. Prefira funções/RPCs com privilégios mínimos quando não houver necessidade de service role.

## 4. Variáveis de ambiente

Manter `.env.example` sem valores secretos:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
ACESSORIAS_API_URL=https://api.acessorias.com
ACESSORIAS_API_TOKEN=
```

`.env.local` nunca é versionado. Validar as variáveis server-side no boot/build e separar schema público do schema secreto. Nunca prefixar a chave secret (papel `service_role`) ou o token Acessórias com `NEXT_PUBLIC_`. A chave secret só é necessária a partir da Fase 3 (sincronização e provisionamento).

## 5. Organização da interface

Desktop:

```text
┌──────────────┬────────────────────────────────┐
│              │ Header                         │
│   Sidebar    ├────────────────────────────────┤
│              │ Conteúdo                       │
└──────────────┴────────────────────────────────┘
```

Sidebar:

- Dashboard
- Clientes
- Vencimentos
- Administração
  - Usuários
  - Hierarquia
  - Integrações
  - Auditoria

O grupo Administração aparece apenas quando autorizado, sem substituir a proteção server-side.

Componentes reutilizáveis esperados:

```text
AppSidebar          AppHeader          PageHeader
MetricCard          StatusBadge        ExpirationBadge
DataTable           Pagination         FilterBar
ClientCard          ClientHeader
ExpirationForm      ExpirationTable    ExpirationDetails
RequestTable        RequestTimeline
UserForm            UserTable          HierarchyTree
EmptyState          ErrorState         LoadingState
ConfirmDialog
```

Criar componentes quando houver uso real; não gerar shells vazios antecipadamente.

## 6. Server state e formulários

- TanStack Query gerencia cache, revalidação e estados de consulta no cliente.
- Chaves de query incluem escopo funcional, filtros, ordenação e página; identidade/autorização vem da sessão, não de parâmetro confiado.
- Após mutações, invalidar somente as chaves afetadas.
- React Hook Form usa schema Zod compartilhado quando possível.
- Toda mutação revalida dados no servidor e deriva autoria/escopo da sessão.
- Desabilitar submissão duplicada e apresentar erros por campo e erro geral.

## 7. Paginação e busca

Clientes e vencimentos usam paginação, filtros e ordenação server-side. A UI envia apenas filtros validados e uma lista fechada de campos de ordenação. Não interpolar nome de coluna arbitrário.

Busca textual usa debounce. Respostas incluem itens, página, tamanho da página e total quando a consulta suportar. Não carregar tudo para filtrar no React.

## 8. Datas

- Banco: `DATE` para emissão/vencimento e `TIMESTAMPTZ` para eventos.
- Interface: `dd/MM/yyyy`.
- Cálculos: `America/Sao_Paulo` explicitamente.
- `dias restantes = expiration_date - data_atual_operacional` em dias civis.
- Hoje fica na faixa 0–7; ontem é vencido; o limite 7 pertence à primeira faixa, 15 à segunda e 30 à terceira.
- Testes de data congelam o relógio e cobrem virada do dia/mês/ano e horário de verão histórico sem depender do fuso da máquina.

## 9. Logging e tratamento de erros

- Criar logger centralizado, com níveis e campos estruturados.
- Sanitizar erros externos antes de enviar à UI.
- Correlation/request ID deve conectar ação administrativa e log de sincronização quando houver infraestrutura para isso.
- Nunca registrar password, access/refresh token, service role ou token Acessórias.
- Falhas não podem resultar em toast de sucesso ou cursor avançado.

## 10. Ordem de implementação

### Fase 0 — Setup

- iniciar Next.js/App Router e TypeScript estrito;
- configurar Tailwind, shadcn/ui, lint e formatter;
- criar `.env.example` e validação de ambiente;
- configurar scripts `dev`, `build`, `lint`, `typecheck` e `test`.

Saída: aplicação mínima compila, lint/typecheck passam e nenhum secret está presente.

Estado (15/10/2026): concluída. Versões adotadas: Next.js 16.4, React 19.3, Tailwind 4, shadcn/ui (preset `base-nova`, primitivas `@base-ui/react`), Zod 4, Vitest 5, Node 24. A validação de ambiente está em `src/config/env.ts` (pública) e `src/config/env.server.ts` (`server-only`); as variáveis públicas são validadas no boot do servidor (`src/instrumentation.ts`), e as secretas no primeiro uso server-side, já que só são necessárias a partir da Fase 3.

### Fase 1 — Banco

- conectar ao Supabase corporativo e inspecionar o schema;
- criar migrations de enums, tabelas, índices, funções e RLS;
- provisionar o admin de modo idempotente;
- gerar tipos TypeScript do schema.

Saída: migrations revisadas, não destrutivas e testes de RLS executáveis. Não iniciar funcionalidades dependentes antes disso.

Estado (15/10/2026): migrations `legal_001` a `legal_009` aplicadas em produção; o resultado de `legal_verify_schema.sql` coincide com o da validação local.

Tipos TypeScript: `src/types/database.ts` é gerado a partir das migrations aplicadas no PGlite (`npm run db:types`), no formato do `supabase gen types`, sem token nem acesso ao projeto real. O teste `supabase/tests/database-types.test.ts` falha se uma migration mudar e os tipos não forem regenerados.

Testes de banco: `supabase/tests/` aplica as migrations duas vezes (idempotência) em um Postgres em memória ([PGlite](https://pglite.dev)) com um stub mínimo do Supabase (`supabase_stub.sql`: papéis `anon`/`authenticated`/`service_role`, privilégios padrão, `auth.users` e `auth.uid()`), e executa os cenários de acesso de `AUTHORIZATION.md` §9 trocando de papel e claims JWT. Rodam no `npm test` e nunca conectam ao banco real. O stub não reproduz todo o Supabase; a verificação em produção é feita com `supabase/inspect/legal_verify_schema.sql`.

Aplicação em produção (feita pelo responsável, no SQL Editor):

1. `npm run db:bundle` gera `supabase/apply/legal_apply.sql` (não versionado), com todas as migrations em uma transação única. Para um intervalo: `npm run db:bundle -- legal_010 legal_012`.
2. Colar e executar o arquivo no SQL Editor.
3. Executar `supabase/inspect/legal_verify_schema.sql` e conferir o JSON.

### Fase 2 — Autenticação

- login, sessão, perfil ativo, logout e proteção de rotas;
- guards server-side e navegação autorizada;
- teste de usuário inativo e rotas privadas.

Estado (15/10/2026): implementada. Validação automatizada: testes unitários, build e checagens HTTP contra o Supabase real (redirecionamentos e bloqueio de `anon` pela API REST). Validação manual do login com usuário real: pendente.

- `src/proxy.ts`: renova a sessão (`getClaims`) e redireciona quem não está autenticado para `/login?next=…`. É só uma checagem otimista.
- `src/lib/auth/session.ts` (DAL): `getSessionState()` (memoizado por requisição) e `requireProfile()`. Sem sessão, redireciona para `/login`. Com sessão mas sem perfil ativo, encerra a sessão via `/auth/signout?erro=sem-acesso`.
- O layout `(dashboard)` envolve todo o conteúdo privado em `requireProfile()` dentro de `<Suspense>`, exigência do `cacheComponents` para leituras de cookies.
- Login por Server Action: valida com Zod, devolve mensagem genérica para credenciais inválidas e encerra a sessão se o usuário não tiver perfil ativo. O destino `next` é validado contra open redirect (`safeNextPath`).
- Usuário inativo com sessão válida não lê dados (garantido pelo RLS) e é deslogado na próxima navegação.
- O formulário de login usa `useActionState` com Server Action, sem React Hook Form: são dois campos e ele funciona mesmo antes do JavaScript carregar. React Hook Form entra nos formulários maiores (Fase 6).

### Fase 3 — Acessórias

- cliente HTTP tipado;
- validação de contratos reais;
- services de usuários, departamentos e empresas;
- sincronização, cursor e logs;
- painel mínimo para teste/manual sync admin.

### Fase 4 — Escopo

- funções de perfil/árvore/cliente;
- policies completas;
- matriz USER a ADMIN;
- testes explícitos USER A versus cliente de USER B.

Bloqueio de fase: não avançar sem comprovar RLS pelas vias de acesso direto.

### Fase 5 — Clientes

- listagem, busca, paginação, detalhe e abas;
- agregados de vencimentos por cliente;
- estados loading/error/empty.

### Fase 6 — Vencimentos

- criar, consultar, editar, filtrar e calcular display status;
- iniciar/concluir renovação atomicamente;
- histórico e auditoria.

### Fase 7 — Solicitações

- sincronizar resumos;
- listar/filtrar por cliente;
- detalhe server-side, timeline e anexos;
- garantir ausência de mutações.

### Fase 8 — Administração

- usuários, árvore, integrações e auditoria;
- validações de ciclo/nível e transações.

### Fase 9 — Dashboard

- métricas e tabela de próximos vencimentos, com escopo e queries otimizadas.

### Fase 10 — Qualidade

- completar testes unitários, integração e E2E;
- revisar performance, acessibilidade, segurança e UX;
- revisar documentação e operação.

## 11. Estratégia de testes

### Unitários

- cálculo de dias e faixas de vencimento;
- estado visual `EXPIRED` sem mutar o registro;
- schemas Zod;
- transições permitidas de status;
- validação da hierarquia;
- transformação dos payloads do Acessórias;
- classificação de erros/retry.

### Integração

- autenticação e perfil ativo;
- RLS de todas as tabelas;
- criação/edição/exclusão lógica de vencimento;
- início e conclusão atômica da renovação;
- cadeia histórica;
- hierarquia recursiva;
- sincronização idempotente, logs e cursores;
- auditoria.

### E2E prioritário

```text
Login
→ Dashboard
→ Cliente
→ Novo vencimento
→ Acompanhamento
→ Iniciar renovação
→ Concluir renovação
→ Histórico
```

Adicionar E2E de acesso negado e fluxo administrativo principal.

## 12. Definition of Done

Uma tarefa está concluída quando:

- comportamento e tratamento de erros estão completos;
- TypeScript compila em modo estrito;
- lint passa;
- testes relevantes passam;
- RLS e autorização continuam corretas;
- operações assíncronas possuem loading, sucesso, erro e vazio quando aplicável;
- logs não expõem dados secretos;
- não há credenciais versionadas;
- documentação afetada está atualizada.

## 13. Git

Fazer commits pequenos e semanticamente claros antes de grandes mudanças. Sugestão de recortes:

```text
feat/database-schema
feat/authentication
feat/acessorias-sync
feat/client-scope
feat/expiration-management
feat/admin
```

Não criar branches ou commits automaticamente quando a tarefa atual não pedir isso.

## 14. Questões em aberto

Estas questões não invalidam o escopo já definido, mas precisam ser resolvidas antes da parte afetada:

1. Quais são os caminhos, parâmetros, limites e schemas exatos dos endpoints de empresas, usuários, departamentos e listagem de solicitações do Acessórias?
2. Quais transições de status são permitidas (por exemplo, `RENEWING` pode voltar a `ACTIVE`? de quais estados se pode cancelar?) e qual a política de edição/cancelamento/exclusão lógica por nível, além da regra geral de escopo? Adiado pelo responsável em 15/10/2026; bloqueia a Fase 6.
3. Qual tamanho padrão/máximo de página e quais limites máximos de strings devem ser adotados? Proposta aplicada nas migrations, sujeita a revisão: nomes e órgão emissor até 200 caracteres, número do documento até 100, observações até 2000.
4. Como anexos do Acessórias serão entregues com segurança: URL temporária, proxy autorizado ou outro mecanismo?
5. Qual ambiente e processo executarão sincronizações automáticas e com qual frequência?
6. Qual política corporativa de backup, retenção de auditoria e retenção de logs deve ser aplicada?
7. **Responsável do vencimento (RF-05):** "preencher automaticamente a partir do contexto autorizado" pode significar o usuário logado ou o perfil cujo e-mail é o responsável do cliente no Acessórias. Também falta definir quais valores de `responsible_user_id` são aceitos (AUTHORIZATION.md §9 exige rejeitar valores forjados). Bloqueia a Fase 6; hoje o banco aceita qualquer perfil existente.
8. **Subordinados inativos no escopo:** a implementação mantém a carteira de um subordinado inativo visível ao gestor, para que não fique órfã. Confirmar se é o comportamento desejado.
9. `npm audit` aponta 5 vulnerabilidades altas em `braces`, na cadeia de dependências de desenvolvimento do `eslint-config-next` 16.4.1. A correção sugerida rebaixa o pacote para a versão 14, então fica pendente até sair uma versão corrigida. Isso não afeta o bundle de produção.

Ao obter uma resposta, atualizar o documento técnico correspondente e remover a questão desta lista.
