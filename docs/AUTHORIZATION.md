# Autenticação, autorização e RLS

## 1. Princípios

- Supabase Auth autentica; `legal_profiles` autoriza.
- O browser nunca decide o escopo efetivo.
- Middleware melhora a navegação, mas RLS é a barreira final.
- Toda consulta direta, REST, Server Action ou Route Handler deve produzir o mesmo resultado de autorização.
- Service role é exclusivamente server-side e usada apenas em tarefas administrativas/integradoras justificadas.
- Usuário inativo não acessa dados mesmo que sua sessão Auth ainda seja válida.

## 2. Resolução do perfil

Para cada sessão:

1. obter o usuário da sessão por `legal_auth_uid()`, que retorna `auth.uid()` somente se o JWT indicar login Microsoft (`amr` com método `oauth` e `app_metadata.providers` contendo `azure`); qualquer outra sessão é tratada como sem perfil;
2. localizar `legal_profiles.user_id = legal_auth_uid()`;
3. exigir `active = true`;
4. usar `id`, `email`, `hierarchy_level`, `manager_id` e `is_admin` desse perfil;
5. nunca aceitar e-mail, papel ou perfil enviados pelo browser como autoridade.

Provisionamento inicial: se o usuário Auth `desenvolvimento@escritoriologica.com.br` existir, migration/script idempotente cria ou atualiza seu perfil como `ADMIN` e `is_admin = true`. Depois disso, toda decisão consulta o banco.

## 3. Hierarquia e escopo

```text
DIRECTOR
└── MANAGER
    └── COORDINATOR
        └── LEADER
            └── USER
```

`manager_id` aponta para o superior direto. O escopo inclui sempre o próprio perfil.

| Nível | Perfis incluídos no escopo |
| --- | --- |
| USER | Somente o próprio perfil. |
| LEADER | Próprio + subordinados diretos USER. |
| COORDINATOR | Próprio + todos os LEADER/USER abaixo na sua árvore. |
| MANAGER | Próprio + toda a árvore abaixo. |
| DIRECTOR | Todos os perfis/clientes. |
| ADMIN ou `is_admin = true` | Acesso total. |

Para LEADER, a SRS limita explicitamente a subordinados diretos. Para COORDINATOR e MANAGER, usar busca recursiva pela árvore. DIRECTOR/ADMIN não dependem do vínculo de gestor para visão global.

Um cliente entra no escopo quando seu `lower(trim(legalization_responsible_email))` coincide com o e-mail normalizado de qualquer perfil incluído. Cliente sem responsável/e-mail correspondente só é visível a DIRECTOR e ADMIN até correção da origem.

## 4. Validação da árvore

Operações administrativas devem rejeitar:

- `manager_id = id`;
- ciclos diretos ou indiretos;
- gestor inativo;
- ADMIN subordinado como parte da árvore operacional;
- relação em que o gestor não esteja acima do subordinado na ordem USER < LEADER < COORDINATOR < MANAGER < DIRECTOR;
- alteração que deixe descendentes com níveis incompatíveis.

Reorganização ocorre em transação e gera auditoria com estado anterior e novo.

## 5. Funções auxiliares

### `legal_current_profile()`

Retorna no máximo um perfil ativo associado a `auth.uid()`. Sessão sem perfil ativo não tem acesso.

### `legal_is_admin()`

Retorna verdadeiro quando o perfil ativo tem `is_admin = true` ou `hierarchy_level = ADMIN`.

### `legal_get_user_scope()`

Retorna IDs de `legal_profiles` visíveis ao usuário atual. Implementar a recursão de forma protegida contra ciclos. Para DIRECTOR/ADMIN, retorna todos os perfis relevantes.

### `legal_can_access_client(client_uuid)`

Retorna verdadeiro se:

- o perfil é DIRECTOR/ADMIN; ou
- o e-mail responsável do cliente coincide com algum perfil em `legal_get_user_scope()`.

As funções usadas por policies devem evitar recursão RLS, fixar `search_path` e ter privilégios mínimos conforme `DATABASE.md`.

## 6. Matriz de operações

| Recurso/operação | USER/gestor dentro do escopo | DIRECTOR | ADMIN |
| --- | --- | --- | --- |
| Ler cliente | Sim | Todos | Todos |
| Editar dados sincronizados do cliente | Não | Não | Não; corrigir na origem |
| Ler vencimento | Sim | Todos | Todos |
| Criar/editar vencimento | Sim | Todos | Todos |
| Iniciar/concluir renovação | Sim | Todos | Todos |
| Cancelar/excluir logicamente vencimento | Sim, se regra de UI permitir | Todos | Todos |
| Ler solicitação | Sim | Todos | Todos |
| Alterar solicitação | Nunca nesta versão | Nunca | Nunca |
| Ler próprio perfil | Sim | Sim | Sim |
| Gerenciar perfis/hierarquia | Não | Não | Sim |
| Rodar sincronização manual | Não | Não | Sim |
| Ler auditoria global | Não | Não | Sim |
| Ler status/log de integração | Não | Não | Sim |

## 7. Policies mínimas

### `legal_profiles`

- SELECT: perfil próprio; ADMIN lê todos. Gestores podem receber somente os campos estritamente necessários à árvore por view/RPC segura, evitando expor dados administrativos desnecessários.
- INSERT/UPDATE: apenas fluxo administrativo server-side autorizado.
- DELETE: negado à aplicação.

### `legal_clients`

- SELECT: `legal_can_access_client(id)`.
- INSERT/UPDATE: somente serviço de sincronização no servidor.
- DELETE: negado.

### `legal_expirations`

- SELECT: acesso ao `client_id` e `deleted_at IS NULL`, exceto telas históricas autorizadas que incluem excluídos.
- INSERT: acesso ao cliente e autoria derivada da sessão.
- UPDATE: acesso ao cliente; impedir troca para cliente fora do escopo, alteração de autoria e edição direta que burle renovação.
- DELETE físico: negado.

### `legal_acessorias_requests`

- SELECT: localizar `legal_clients.acessorias_company_id` e exigir acesso ao cliente.
- Escrita: somente sincronização server-side.

### `legal_audit_logs`

- SELECT: ADMIN; acesso pontual ao histórico de cliente pode ser fornecido por RPC/view que filtre o escopo.
- INSERT: somente funções/servidor autorizados.
- UPDATE/DELETE: negados.

### `legal_sync_logs` e `legal_settings`

- SELECT/UPDATE: somente ADMIN por operação server-side.
- Escrita de logs: orquestrador de sincronização.
- DELETE: negado à aplicação.

### `legal_acessorias_users`

- SELECT: somente o mínimo necessário em fluxos internos autorizados; gestão completa para ADMIN.
- Escrita: sincronização server-side.

## 8. Proteção de rotas

- `/login`: redirecionar usuário já autenticado e ativo para `/dashboard`.
- Rotas de dashboard: exigir sessão + perfil ativo no layout/server boundary.
- `/clients/[id]`, `/expirations/[id]` e Server Actions: buscar o registro usando consulta já limitada por RLS; “não encontrado”/acesso negado não deve vazar dados.
- `/admin/**`: exigir `legal_is_admin()` no servidor. Ocultar menu é apenas conveniência visual.
- Ao desativar perfil, futuras requisições falham mesmo antes do token Auth expirar.

## 9. Testes de segurança obrigatórios

Criar usuários A e B com carteiras diferentes e testar:

- A lista de A não contém cliente/vencimento/solicitação de B.
- A conhece o UUID de B e tenta abrir a URL: acesso negado.
- A chama Route Handler/Server Action manualmente com UUID de B: acesso negado.
- A consulta Supabase REST diretamente: nenhuma linha retornada ou erro de acesso.
- A tenta criar vencimento para cliente de B: rejeitado.
- A tenta mover vencimento próprio para cliente de B: rejeitado.
- A tenta forjar `created_by`, `responsible_user_id` ou papel admin: valores rejeitados/derivados da sessão.
- Perfil inativo com sessão válida não lê dados.
- Não-admin acessa `/admin` e RPC administrativa: negado.
- ADMIN acessa dados e operações previstas, mantendo auditoria.

O critério central é `ACCESS DENIED` por todas as vias, não apenas pela interface.
