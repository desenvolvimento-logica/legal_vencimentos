# Integração com o Sistema Acessórias

## 1. Contrato geral

```text
Base URL: https://api.acessorias.com
Documentação: https://api.acessorias.com/documentation
Header: Authorization: Bearer {ACESSORIAS_API_TOKEN}
```

O token é secreto server-side. Deve existir somente em `ACESSORIAS_API_TOKEN` e nunca aparecer em componente cliente, bundle, localStorage, resposta pública, banco acessível ao usuário, logs ou Git.

Clientes, responsáveis e solicitações têm o Acessórias como fonte oficial. A aplicação mantém cache no Supabase para desempenho e controle de rate limit. Solicitações são estritamente somente leitura nesta versão.

## 2. Arquitetura obrigatória

O único ponto de acesso HTTP é `src/lib/acessorias/client.ts`.

```text
React/UI
  → Server Action ou Route Handler autorizado
    → Service de domínio
      → AcessoriasApiClient
        → api.acessorias.com
```

Componentes React não conhecem URL, token ou payload bruto do Acessórias.

Implementar responsabilidades separadas:

- `AcessoriasApiClient`: transporte, autenticação, timeout, parsing, rate limit, retry e erro tipado;
- `AcessoriasCompanyService`: empresas, departamentos e responsável da Legalização;
- `AcessoriasUserService`: usuários do Acessórias;
- `AcessoriasDepartmentService`: identificação/validação do departamento;
- `AcessoriasRequestService`: lista e detalhe de solicitações;
- serviços em `src/services/sync/`: orquestração, upsert, cursor e logs.

## 3. Cliente HTTP

Requisitos:

- URL obtida de `ACESSORIAS_API_URL`, com default `https://api.acessorias.com`;
- Bearer token lido no servidor a cada inicialização do cliente;
- timeout explícito por `AbortController`;
- headers e serialização centralizados;
- Zod para validar toda resposta antes de chegar ao domínio;
- erro `AcessoriasApiError` com código HTTP, código de negócio quando existir, endpoint sanitizado, retryability e causa;
- nunca incluir token ou payload sensível na mensagem/log.

Uma resposta só é sucesso quando o HTTP é aceitável, o corpo é válido e não contém a propriedade de erro de negócio `Erro`.

```ts
export class AcessoriasApiError extends Error {
  readonly status?: number;
  readonly retryable: boolean;
  readonly endpoint: string;
}
```

O formato acima é a responsabilidade mínima; detalhes podem evoluir sem expor o payload bruto à UI.

## 4. Retry e rate limit

- Repetir apenas falhas transitórias: timeout, conexão, HTTP 429 e 5xx apropriados.
- Não repetir erros de validação, autenticação/autorização ou erros de negócio permanentes.
- Usar exponential backoff com jitter e limite de tentativas.
- Respeitar `Retry-After` quando presente.
- Operações de sincronização devem ser idempotentes.
- Não disparar uma sincronização completa ao abrir telas.
- Impedir duas execuções concorrentes do mesmo tipo por lock no servidor/banco.

Os valores de timeout, tentativas e atraso são configuração server-side. Defini-los no código/configuração após validar o comportamento real da API, sem inventar limites atribuídos ao Acessórias.

## 5. Paginação

Criar helper reutilizável:

```ts
paginateAcessorias<T>()
```

O helper deve:

1. solicitar uma página por vez;
2. validar o payload;
3. entregar itens ao consumidor sem acumular obrigatoriamente todo o conjunto em memória;
4. avançar a página somente depois do processamento bem-sucedido;
5. parar quando a API retornar lista vazia;
6. respeitar cancelamento, retry e rate limit;
7. proteger contra loop infinito com invariantes e telemetria.

Não duplicar lógica de paginação nos services. Parâmetros exatos de página devem seguir a documentação/resposta real da API.

## 6. Sincronização de empresas

### Carga completa

Para cada empresa, obter e mapear:

| Acessórias | `legal_clients` |
| --- | --- |
| ID/EmpID | `acessorias_company_id` |
| CNPJ/CPF | `document_number` |
| Razão Social | `corporate_name` |
| Nome Fantasia | `trade_name` |
| Status | `status` |
| UF | `state` |
| Departamento Legalização.ID | `legalization_department_id` |
| Departamento Legalização.RespNome | `legalization_responsible_name` |
| Departamento Legalização.RespEmail | `legalization_responsible_email` |
| ID do responsável, quando disponível | `legalization_responsible_acessorias_user_id` |
| Data de alteração na origem | `acessorias_updated_at` |
| Momento da importação | `synced_at` |

O payload de departamentos documentado contém `ID`, `Nome`, `RespNome` e `RespEmail`. Localizar a Legalização pelo ID armazenado em `legal_settings`; nome textual serve para diagnóstico, não como chave permanente.

Fazer upsert por `acessorias_company_id`. Normalizar documento e e-mail para busca/comparação sem perder o valor necessário à exibição.

### Carga incremental

1. Ler `last_successful_company_sync`.
2. Enviar o valor pelo parâmetro `DtLastDH` conforme contrato real do endpoint.
3. Processar todas as páginas.
4. Se tudo terminar, marcar log `SUCCESS` e atualizar cursor no mesmo fechamento lógico.
5. Se houver falha, marcar `PARTIAL` ou `FAILED` e conservar o cursor anterior.

Não usar o horário de término como cursor sem confirmar a semântica do endpoint. Preferir o maior timestamp de origem processado ou a estratégia indicada pela documentação, evitando perda de alterações concorrentes.

## 7. Sincronização de usuários

Persistir em `legal_acessorias_users` por `acessorias_user_id`:

- nome;
- e-mail normalizado;
- status;
- `synced_at`.

Essa tabela não autoriza login. Acesso à aplicação depende de `auth.users` + `legal_profiles` ativo.

Atualizar `last_successful_user_sync` somente após sucesso integral.

## 8. Sincronização de solicitações

Persistir o resumo em `legal_acessorias_requests`, com upsert por `acessorias_request_id`. Relacionar por `EmpID`/`acessorias_company_id`; usar CNPJ/CPF somente como fallback controlado e registrar ambiguidades.

Campos mínimos: empresa, tipo, assunto, prioridade, status, solicitante, departamento, responsáveis do escritório, abertura, prazo, última atualização, conclusão e instante de sincronização.

No detalhe, `/requests/{SolID}` pode ser consultado server-side para obter interações e anexos. Validar URLs/metadados de anexos e nunca repassar headers secretos ao browser.

Proibido pela versão inicial:

- POST de nova solicitação;
- atualização de solicitação;
- conclusão;
- comentário;
- upload ou alteração de anexo.

Atualizar `last_successful_request_sync` somente após sucesso integral.

## 9. Log de execução

Ao iniciar, inserir `legal_sync_logs` com `RUNNING`. Ao finalizar, registrar:

- `SUCCESS`, `PARTIAL` ou `FAILED`;
- início e término;
- recebidos, criados, atualizados e falhos;
- mensagem sanitizada;
- metadados úteis como páginas e cursor, sem secrets.

Falha em um registro pode produzir `PARTIAL` quando os demais forem persistidos de forma segura. Uma falha estrutural que invalida o lote é `FAILED`. Nenhum dos dois avança o cursor global.

## 10. Testes mínimos

- HTTP 200 com `{ "Erro": "..." }` gera `AcessoriasApiError`.
- 429 respeita política de retry; 4xx permanente não repete.
- Paginação termina apenas com lista vazia e não duplica itens.
- Mapeadores rejeitam payload incompatível.
- Carga incremental usa o cursor anterior e só o avança no sucesso.
- Upsert repetido é idempotente.
- Erros e logs não contêm token.
- A tela de solicitações nunca oferece ou envia mutações.

## 11. Contratos comprovados (15/10/2026)

Confirmados na documentação oficial e com chamadas reais somente leitura (só a estrutura foi inspecionada; fixtures sanitizados em `src/lib/acessorias/fixtures.ts`).

| Recurso | Endpoint | Observações |
| --- | --- | --- |
| Departamentos | `GET /departments/ListAll` | Legalização = **5**; subdepartamento **13** (Certificado Digital, `IDPai` 5). O 4 é Financeiro. |
| Empresas | `GET /companies/ListAll?departments=5,13&DtLastDH=…&Pagina=N` | `departments` filtra os departamentos retornados em `Departamentos[]` (`ID`, `Nome`, `RespNome`, `RespEmail`). Não há ID do usuário responsável. `DtLastDH` aceita ISO 8601 ou `aaaa-mm-dd hh:mm:ss`. ~2.009 empresas (101 páginas). |
| Usuários | `GET /users/ListAll?Pagina=N` | Campos `id`, `nome`, `email`, `status`. Sem filtro incremental. ~343 usuários. |
| Solicitações | `GET /requests/ListAll?SolUltAtIni=aaaa-mm-dd&Pagina=N` | **Sem filtro de departamento ou empresa**; ~258 mil no total. O filtro por departamento (`DptoID` 5/13) é feito após o download. Atualizadas por dia: ~57 páginas. |
| Detalhe | `GET /requests/{SolID}` | Interações em `SolInteracoes`, anexos em `CmtAnx` (`Nome`, `Url`). Usado na Fase 7. |

- Datas/hora chegam como `dd/mm/aaaa hh:mm:ss` no horário de Brasília, sem fuso; são convertidas para UTC (`src/lib/acessorias/dates.ts`).
- Paginação: 20 itens por página; termina na lista vazia. HTTP 204 = sem conteúdo.
- Limite: 100 req/min (janela deslizante). O cliente usa 90 req/min para não disputar a cota com outros sistemas. 429 vem sem corpo.
- Erros de negócio: HTTP 200 com `{ "Erro": "..." }`.

## 12. Sincronização implementada

- `/api/sync` (GET): Vercel Cron diário às 09:00 UTC (06:00 em Brasília), incremental em empresas, usuários e solicitações. Protegido por `CRON_SECRET`.
- `npm run sync -- <tipos> [--full]`: chama `/api/sync` (POST) de um servidor local para a carga inicial, que excede o limite de 300 s de uma função na Vercel.
- Empresas: o cursor é a maior `DtLastDH` processada, reusado com 60 s de margem.
- Usuários: sempre carga completa.
- Solicitações: carga completa limitada a `acessorias_request_initial_window_days` (90) dias; incremental desde o dia do último sucesso.
