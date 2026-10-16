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

Estado (15/10/2026): implementada. Validação automatizada: testes unitários, build e checagens HTTP contra o Supabase real (redirecionamentos e bloqueio de `anon` pela API REST). Validação manual (15/10/2026): login Microsoft de ponta a ponta confirmado pelo responsável em produção (https://legal-vencimentos.vercel.app).

- `src/proxy.ts`: renova a sessão (`getClaims`) e redireciona quem não está autenticado para `/login?next=…`. É só uma checagem otimista.
- `src/lib/auth/session.ts` (DAL): `getSessionState()` (memoizado por requisição) e `requireProfile()`. Sem sessão, redireciona para `/login`. Com sessão mas sem perfil ativo, encerra a sessão via `/auth/signout?erro=sem-acesso`.
- O layout `(dashboard)` envolve todo o conteúdo privado em `requireProfile()` dentro de `<Suspense>`, exigência do `cacheComponents` para leituras de cookies.
- Login exclusivo com Microsoft: a Server Action `signInWithMicrosoft` inicia o OAuth (provedor `azure`, PKCE) e `/auth/callback` troca o código pela sessão. Se o usuário não tiver perfil ativo, a sessão é encerrada e ele volta ao login com a mensagem de sem acesso. O destino `next` é validado contra open redirect (`safeNextPath`).
- No Supabase (Authentication → URL Configuration → Redirect URLs), liberar `http://localhost:3000/auth/callback` e `https://<domínio de produção>/auth/callback`. Não alterar a Site URL, que é compartilhada com outros sistemas. O `redirectTo` enviado pelo app não tem query string (o destino pós-login vai no cookie `legal_auth_next`), porque o Supabase só aceita URLs idênticas às cadastradas. Se a URL não estiver na lista, o Supabase devolve o usuário para a Site URL de outro sistema (`hub-logica`).
- Usuário inativo com sessão válida não lê dados (garantido pelo RLS) e é deslogado na próxima navegação.

### Fase 3 — Acessórias

- cliente HTTP tipado;
- validação de contratos reais;
- services de usuários, departamentos e empresas;
- sincronização, cursor e logs;
- painel mínimo para teste/manual sync admin.

Estado (15/10/2026): implementada (contratos, cliente HTTP, mapeadores, orquestração e `/api/sync`), com 136 testes. Ainda faltam:
- aplicar `legal_011` e `legal_012` em produção;
- executar a carga inicial com `npm run sync`.

O painel administrativo de integrações fica para a Fase 8; até lá, o status das execuções fica em `legal_sync_logs`. Detalhes em ACESSORIAS.md §11–12.

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

Estado (15/10/2026): listagem `/clients` (mockup 03) implementada.
- **Dados:** vêm da view `legal_client_overview` (`legal_013`, `security_invoker`), com agregados de vencimentos. Busca por razão social, nome fantasia e CNPJ (só dígitos), ordenação por lista fechada de colunas e paginação no servidor (10/20/50 por página).
- **Estado na URL:** filtros e ordenação são links e formulários `GET`, que funcionam sem JavaScript. "Atualizar" recarrega do banco, sem disparar sincronização.
- **TanStack Query:** ainda não usado, porque as telas atuais são Server Components com estado na URL. Entra quando houver estado de servidor no cliente (formulários e mutações da Fase 6).
- **Pendente:** detalhe do cliente (mockup 04).

### Fase 6 — Vencimentos

- criar, consultar, editar, filtrar e calcular display status;
- iniciar/concluir renovação atomicamente;
- histórico e auditoria.

Estado (16/10/2026): implementada.
- **Drawer de cadastro e edição** (mockup 04): React Hook Form com o mesmo schema Zod do servidor; o responsável padrão vem da carteira.
- **Ações por linha:** iniciar, desistir e concluir renovação; cancelar com motivo; excluir.
- **`/expirations`** (mockup 05): busca, filtros, atalhos de 7/15/30/60 dias e vencidos, ordenação e paginação no servidor (view `legal_expiration_list`, `legal_017`). "Novo vencimento" fora do cliente pede antes a escolha do cliente.
- **`/expirations/[id]/renew`** (mockup 07): registro atual, novo registro e cadeia histórica.
- **Validação manual com usuário real:** pendente.

Regras de ciclo de vida (decididas pelo responsável em 16/10/2026; `legal_016`, aplicadas no banco):
- **Situações:** ACTIVE → RENEWING → RENEWED (só por `legal_complete_renewal`); RENEWING → ACTIVE (desistir); ACTIVE/RENEWING → CANCELLED, com motivo obrigatório. RENEWED e CANCELLED são finais. EXPIRED não é gravado pela aplicação.
- **Correção de data:** permitida em registros ACTIVE, com auditoria. O cliente do vencimento é imutável.
- **Cancelar e excluir:** permitido a qualquer usuário com acesso ao cliente. A exclusão é lógica, por `legal_delete_expiration`, e é bloqueada para registros da cadeia de renovação.
- **Responsável:** o padrão é o da carteira do cliente e pode ser editado. O banco aceita perfil ativo do escopo de quem grava ou responsável do cliente no Acessórias. `legal_visible_profiles()` expõe só nome, e-mail e nível dos perfis relevantes.

### Fase 7 — Solicitações

- sincronizar resumos;
- listar/filtrar por cliente;
- detalhe server-side, timeline e anexos;
- garantir ausência de mutações.

Estado (16/10/2026): implementada (mockup 08), na aba Solicitações do cliente.
- **Lista:** filtros de status, tipo, responsável e período de abertura. Os valores possíveis vêm do cache do próprio cliente.
- **Detalhe:** ao abrir, consulta `/requests/{SolID}` no servidor, só depois de confirmar pelo RLS que a solicitação pertence a um cliente visível. Mostra os dados, a linha do tempo das interações e os anexos. É somente leitura, sem nenhuma mutação.
- **Anexos via servidor** (decisão de 16/10/2026): as URLs do Acessórias são públicas (`app.acessorias.com/…?AnxKey=…` responde sem autenticação), então nunca chegam ao navegador.
  - O navegador recebe uma chave opaca (hash da URL). `/api/requests/[solId]/attachments/[key]` exige perfil ativo, revalida o acesso e baixa só de `https://app.acessorias.com`, sem seguir redirecionamentos.
  - O arquivo é repassado com limite de 50 MB e nome sanitizado.

### Fase 8 — Administração

- usuários, árvore, integrações e auditoria;
- validações de ciclo/nível e transações.

Estado (16/10/2026): usuários (mockup 09) implementados.
- **`/admin/*`:** exige ADMIN no servidor (`requireAdmin`, 404 para os demais). O menu Administração só aparece para ADMIN.
- **Adicionar usuário:** escolhe uma conta Microsoft já existente em `auth.users` que ainda não tem perfil (`legal_admin_list_profile_candidates`) e define nome, cargo, nível e gestor.
- **Editar usuário:** nome, cargo, nível, gestor e ativo. O e-mail vem da conta Microsoft. Os gestores possíveis são os perfis ativos de nível acima, e o banco revalida a hierarquia.
- **Funções `legal_admin_*`** (`legal_018`): SECURITY DEFINER, exigem ADMIN e gravam auditoria (`PROFILE_CREATED`, `PROFILE_UPDATED`, `PROFILE_LEVEL_CHANGED`, `PROFILE_MANAGER_CHANGED`, `PROFILE_ACTIVATED`, `PROFILE_DEACTIVATED`). O ADMIN não consegue se desativar nem se rebaixar.
- **`/admin/hierarchy`** (mockup 10):
  - árvore indentada a partir de `manager_id`, sem o ADMIN, com nível sempre indicado por ícone e rótulo e a contagem de clientes da carteira;
  - aviso de usuários sem gestor e busca que mantém o caminho até a pessoa;
  - painel para trocar o gestor (`changeManager` → `legal_admin_update_profile`, com auditoria).
  - Usa árvore indentada em vez do organograma horizontal do mockup, que não cabe em telas estreitas.
- **`/admin/integrations`** (mockup 06):
  - teste de conexão (uma chamada de leitura);
  - cards com a última execução de cada tipo;
  - sincronização manual **incremental** por Server Action (`maxDuration` 300 s, ADMIN exigido, paralelismo bloqueado por `legal_012`);
  - histórico paginado com duração e erro.
  - A carga completa continua pelo `npm run sync`.
- **`/admin/audit`** (mockup 11):
  - filtros de usuário, ação, entidade e período (Brasília), com paginação;
  - detalhe com os campos alterados lado a lado (antes/depois), ignorando `updated_at`/`updated_by`;
  - somente leitura, sem editar, excluir nem exportar. IP/origem não são registrados.
- **Carga inicial de perfis (16/10/2026):** a pedido do responsável, foram criados 7 perfis USER, sem gestor, para as responsáveis da Legalização com clientes ativos. Foi gravado com a chave secret, pois as contas ainda não tinham identidade Microsoft; cada criação ficou na auditoria com o ADMIN como autor.

### Fase 9 — Dashboard

- métricas e tabela de próximos vencimentos, com escopo e queries otimizadas.

Estado (16/10/2026): implementada (mockup 02).
- **Indicadores** (via RLS): total de clientes, vencidos, próximos 7/15/30 dias (janelas acumuladas a partir de hoje), em renovação e renovados no mês corrente, no horário de Brasília. Ao clicar, cada card de vencimentos abre um popup com os itens que compõem o número (até 50, com link para a tela Vencimentos); a regra de cada indicador fica em `src/services/dashboard/metrics.ts` e é usada tanto na contagem quanto no popup. "Total de clientes" leva à tela Clientes (pedido do responsável em 16/10/2026).
- **Tabela de próximos vencimentos:** janelas de 7/15/30 dias, incluindo os já vencidos.
- **Distribuição por tipo:** usa barra empilhada em vez do donut do mockup, porque parte do todo é mais legível em barra (diretriz de visualização). A paleta categórica foi validada contra a superfície branca, e a legenda mostra quantidade e percentual.

### Fase 10 — Qualidade

- completar testes unitários, integração e E2E;
- revisar performance, acessibilidade, segurança e UX;
- revisar documentação e operação.

## 10.1 Hospedagem (Vercel)

- Produção: https://legal-vencimentos.vercel.app (primeiro deploy em 15/10/2026).
- Região das funções: `cle1` (Cleveland), ao lado do Supabase (AWS us-east-2, Ohio, identificado pelo IP do banco em 16/10/2026). Antes era `iad1` (Virginia), cerca de 10–15 ms por consulta, com várias consultas em sequência por página.
- Projeto `legal-vencimentos` no time Vercel **LuzIA** (plano Hobby; cron limitado a uma execução diária, aceito pelo responsável em 15/10/2026). Node 24.x (`engines` no `package.json`).
- Deploy via integração Git: push no `main` gera produção. O app da Vercel no GitHub precisa de acesso ao repositório `desenvolvimento-logica/legal_vencimentos`.
- Variáveis configuradas nos três ambientes: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `SUPABASE_SECRET_KEY`, `ACESSORIAS_API_TOKEN` e `CRON_SECRET` estão configuradas como variáveis sensíveis, somente em produção. O cron diário está declarado em `vercel.json`.
- A URL de produção (`https://<domínio>/auth/callback`) precisa constar nas Redirect URLs do Supabase. Deploys de preview não fazem login, a menos que suas URLs também sejam liberadas.

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

## 12.1 Revisão de segurança (16/10/2026)

Revisão independente do código e das regras do banco (`legal_001`–`legal_018`): nenhum achado crítico ou alto. Achados de baixa severidade e o tratamento de cada um:

| # | Achado | Tratamento |
| --- | --- | --- |
| 1 | Os bypasses de renovação e exclusão dependem dos GUCs `legal.renewal_context`/`legal.delete_context`. Hoje não são alcançáveis pela API (o PostgREST só expõe funções de `public`), mas outro sistema do projeto compartilhado poderia expor uma função com SQL dinâmico | Risco aceito e registrado. Endurecimento possível: funções com dono dedicado e checagem de `current_user` no trigger |
| 2 | `legal_can_assign_responsible` respondia para qualquer usuário autenticado sobre qualquer cliente | Corrigido em `legal_019` (exige perfil ativo e acesso ao cliente) |
| 3 | Um limitador de requisições por chamada; cada download consultava o Acessórias | Cliente único por instância e cache de 60 s do detalhe |
| 4 | Barra invertida no nome do anexo quebrava o `Content-Disposition` | Corrigido (e `;` também é removido) |
| 5 | `Content-Length` repassado com corpo descomprimido | Só repassado sem `content-encoding` |
| 6 | Mensagens nativas do Postgres (colunas, valores digitados) chegavam à tela | Substituídas por textos fixos; só as mensagens dos triggers `legal_` são repassadas |
| 7 | A checagem "só Microsoft" aceita qualquer OAuth de usuário com identidade azure | Conferido: só os provedores `azure` e `email` estão ativos, e o Azure usa a URL do tenant do escritório. **Não habilitar outros provedores OAuth no projeto compartilhado sem revisar `legal_session_is_microsoft`** |
| 8 | `GET /auth/signout` pode ser disparado por outro site (logout) | Aceito: só encerra a própria sessão |

## 13.1 Onde paramos (16/10/2026)

- **Fases 0 a 9 implementadas.** Em produção estão login Microsoft, Dashboard (com popups por indicador), Clientes, Vencimentos (cadastro, edição, renovação, cancelamento, exclusão), Solicitações (detalhe, timeline e anexos via servidor) e Administração (Usuários, Hierarquia, Integrações, Auditoria). As migrations `legal_001` a `legal_018` foram aplicadas.
- **Validação manual pendente:**
  - download de anexos de solicitações;
  - primeiro login Microsoft das 7 responsáveis (vínculo automática da identidade com a conta existente);
  - telas da Fase 8 com usuário real.
- **Próximo:** Fase 10 (qualidade).
  - Testes E2E do fluxo principal e de acesso negado.
  - Revisão de acessibilidade e desempenho.
  - Definir a hierarquia da equipe (líder/coordenação).

## 14. Questões em aberto

Estas questões não invalidam o escopo já definido, mas precisam ser resolvidas antes da parte afetada:

1. Qual tamanho padrão/máximo de página e quais limites máximos de strings devem ser adotados? Proposta aplicada nas migrations, sujeita a revisão: nomes e órgão emissor até 200 caracteres, número do documento até 100, observações até 2000.
2. Qual política corporativa de backup, retenção de auditoria e retenção de logs deve ser aplicada?
3. **Subordinados inativos no escopo:** a implementação mantém a carteira de um subordinado inativo visível ao gestor, para que não fique órfã. Confirmar se é o comportamento desejado.
4. `npm audit` aponta 5 vulnerabilidades altas em `braces`, na cadeia de dependências de desenvolvimento do `eslint-config-next` 16.4.1. A correção sugerida rebaixa o pacote para a versão 14, então fica pendente até sair uma versão corrigida. Isso não afeta o bundle de produção.

Ao obter uma resposta, atualizar o documento técnico correspondente e remover a questão desta lista.
