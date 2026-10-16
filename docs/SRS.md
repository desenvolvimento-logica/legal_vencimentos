# Software Requirements Specification — Controle de Vencimentos da Legalização

**Versão:** 1.0  
**Status:** desenvolvimento inicial  
**Data de consolidação:** 14/10/2026  
**Aplicação:** web interna  
**Fonte:** SRS fornecida pelo responsável do projeto

## 1. Propósito

Centralizar e automatizar o controle de vencimento de certidões, licenças e certificados do departamento de Legalização. O sistema deve substituir controles paralelos, preservar o histórico de renovações, identificar a carteira de cada colaborador e oferecer visão consolidada à gestão.

O Sistema Acessórias é a fonte oficial de clientes, responsáveis e solicitações. O sistema mantém caches locais para consulta eficiente e para evitar exceder o limite de requisições da API.

## 2. Escopo da versão inicial

Incluído:

- login exclusivamente com conta Microsoft (Azure/Entra ID, tenant do escritório) via Supabase Auth;
- perfis internos e hierarquia organizacional;
- sincronização de clientes, usuários e solicitações do Acessórias;
- carteira de clientes por responsável de Legalização;
- cadastro e acompanhamento de vencimentos;
- renovação com preservação integral do histórico;
- consulta somente leitura de solicitações do Acessórias;
- dashboard operacional e gerencial;
- administração de usuários, hierarquia e integrações;
- auditoria das principais alterações;
- autorização no banco com RLS.

Fora do escopo desta versão:

- criar, editar, concluir ou comentar solicitações no Acessórias;
- autenticação própria ou armazenamento próprio de senha;
- criar um projeto Supabase separado;
- editar manualmente dados de clientes cuja fonte oficial é o Acessórias;
- alterar retroativamente a data de um registro para simular renovação.

## 3. Atores

| Ator | Responsabilidade e visão |
| --- | --- |
| USER | Opera clientes em que seu e-mail é o responsável da Legalização. |
| LEADER | Vê seus clientes e os clientes de subordinados diretos. |
| COORDINATOR | Vê seus clientes e a árvore de líderes e usuários sob sua coordenação. |
| MANAGER | Vê toda a árvore abaixo de sua gestão. |
| DIRECTOR | Vê todos os clientes. |
| ADMIN | Acesso completo, inclusive administração e auditoria. |
| Acessórias | Fonte oficial de clientes, responsáveis, usuários e solicitações. |

A relação hierárquica é formada por `legal_profiles.manager_id`. A semântica detalhada está em `AUTHORIZATION.md`.

## 4. Requisitos funcionais

### RF-01 — Autenticação e sessão

- Autenticar exclusivamente com conta Microsoft (provedor `azure` do Supabase Auth, restrito ao tenant do escritório). Decisão do responsável em 15/10/2026, substituindo o login por e-mail e senha.
- O login por e-mail/senha continua habilitado no projeto Supabase compartilhado, mas sessões que não vieram da Microsoft não acessam nenhum dado deste sistema (bloqueio no banco, `legal_010`).
- Os usuários já existem em `auth.users` (projeto compartilhado). O acesso é concedido criando um perfil em `legal_profiles` para o usuário existente.
- Persistir sessão de forma compatível com Next.js App Router.
- Bloquear perfil inexistente ou com `active = false`.
- Proteger todas as rotas privadas no servidor.
- Permitir logout.
- Manter a autorização (perfil, hierarquia e RLS) desacoplada do provedor de login.

### RF-02 — Perfil e provisionamento administrativo

- Cada usuário autorizado tem um registro único em `legal_profiles`, ligado a `auth.users.id`.
- Provisionar `desenvolvimento@escritoriologica.com.br` com `hierarchy_level = ADMIN` e `is_admin = true`.
- O e-mail serve somente para o provisionamento inicial; a autorização consulta o banco.
- Administradores podem listar, buscar, ativar, desativar e alterar cargo, nível e gestor.
- Usuários com histórico não podem ser apagados fisicamente.

### RF-03 — Sincronização de clientes

- Importar ID da empresa, CNPJ/CPF, razão social, nome fantasia, status, UF, departamentos e responsável da Legalização.
- Identificar Legalização pelo ID em `legal_settings.acessorias_legalization_department_id`; não hardcode o ID.
- Fazer primeira carga completa com paginação.
- Nas próximas cargas, usar `DtLastDH` a partir de `last_successful_company_sync`.
- Avançar o cursor apenas depois de uma sincronização bem-sucedida.
- Fazer upsert por `acessorias_company_id`, sem apagar históricos locais.
- Registrar contadores, estado e erros em `legal_sync_logs`.

### RF-04 — Carteira e clientes

- `/clients`, com título “Meus Clientes”, mostra apenas o escopo autorizado.
- Somente clientes ativos no Acessórias (`Status = Ativa`) aparecem no sistema, para todos os níveis. Inativos continuam no cache para registrar mudanças de situação (decisão de 15/10/2026).
- Colunas: razão social, nome fantasia, CNPJ, responsável Legalização, vencimentos ativos, próximo vencimento e vencidos.
- Busca server-side por razão social, nome fantasia e CNPJ.
- Paginação e ordenação server-side.
- `/clients/[id]` exibe razão social, nome fantasia, CNPJ, ID Acessórias, responsável e status.
- O detalhe tem abas Visão Geral, Vencimentos, Solicitações e Histórico.
- A ação principal é “Novo vencimento”.

### RF-05 — Cadastro de vencimento

- Criar pela rota ou modal `/clients/[id]/expirations/new`.
- Obrigatórios: cliente, tipo, documento e data de vencimento.
- Opcionais: emissão, número, órgão emissor, observações, periodicidade de renovação e lembrete.
- Periodicidade: Mensal, Bimestral, Trimestral, Semestral ou Anual. Com periodicidade, a emissão é obrigatória e o vencimento é calculado como emissão + período (dia inexistente no mês final vira o último dia do mês); sem periodicidade, a data é informada.
- Lembrete: X dias antes do vencimento (1 a 365). A partir dessa data, o vencimento aparece no popup de lembretes do responsável (RF-15).
- Tipo aceita `CERTIDAO`, `LICENCA` ou `CERTIFICADO`.
- Preencher o responsável automaticamente a partir do contexto autorizado.
- Validar no cliente e novamente no servidor com Zod.
- Após sucesso, invalidar consultas afetadas, confirmar a operação e gerar auditoria.

### RF-06 — Acompanhamento de vencimentos

- `/expirations` lista os vencimentos visíveis ao usuário.
- Buscar por razão social, nome fantasia, CNPJ ou documento.
- Filtrar por tipo, status, data inicial e data final.
- Oferecer atalhos: vencidos e próximos 7, 15, 30 ou 60 dias.
- Colunas: cliente, documento, tipo, vencimento, dias, responsável, status e ações.
- Paginação, filtro e ordenação são server-side; padrão `expiration_date ASC`.
- Clicar na linha (ou no nome do documento, pelo teclado) abre um popup com os dados da renovação: emissão, vencimento, periodicidade, lembrete, responsável, situação, sucessor/motivo quando houver e renovações anteriores.

### RF-07 — Estado e vencimento calculado

Estados persistidos: `ACTIVE`, `RENEWING`, `RENEWED`, `EXPIRED` e `CANCELLED`.

Apresentar como vencido quando `expiration_date < current_date` e o estado persistido for `ACTIVE`, mesmo sem job que grave `EXPIRED`. A lógica usa `America/Sao_Paulo`, não o fuso implícito do navegador.

| Condição | Alerta |
| --- | --- |
| Vencido | Vermelho |
| 0 a 7 dias | Vermelho/laranja |
| 8 a 15 dias | Âmbar |
| 16 a 30 dias | Azul |
| Renovado | Verde |

Combinar sempre texto, ícone e badge; cor isolada não é suficiente.

### RF-08 — Renovação

1. Um vencimento `ACTIVE` recebe “Iniciar renovação”.
2. O registro atual muda para `RENEWING` e gera auditoria.
3. Ao concluir, uma operação atômica muda o anterior para `RENEWED` e cria outro `ACTIVE`.
4. O novo aponta para o anterior por `previous_expiration_id`.
5. Falha em qualquer etapa desfaz toda a conclusão.
6. Com periodicidade, “Concluir renovação” conclui direto (com confirmação): o novo registro copia os dados do atual, nasce `ACTIVE` (a renovação dele não é iniciada) e o novo período conta da data de conclusão (emissão = hoje). “Concluir com outros dados” abre o formulário. Sem periodicidade, a conclusão sempre usa o formulário, que exige a nova data.

Não alterar a data do registro anterior para representar a renovação. Toda a cadeia deve ser reconstruível.

### RF-09 — Histórico

- Exibir documento, tipo, emissão, vencimento, status, responsável, criador e data da renovação.
- Incluir criação, edições, início/conclusão de renovação, cancelamento e exclusão lógica.
- Não remover fisicamente a cadeia de vencimentos na operação normal.

### RF-10 — Solicitações do Acessórias

- Sincronizar e armazenar cache local em modo somente leitura.
- Relacionar prioritariamente por `EmpID`; usar CNPJ/CPF como referência secundária.
- Na aba Solicitações, listar ID, assunto, tipo, prioridade, status, responsável, abertura e prazo.
- Filtrar por status, tipo, data e responsável.
- No detalhe, consultar `/requests/{SolID}` quando necessário.
- Mostrar assunto, status, prioridade, abertura, prazo, responsável, departamento, empresa, conclusão, interações e anexos.
- Mostrar interações como timeline.
- Nunca enviar mutação de solicitação ao Acessórias.

### RF-11 — Dashboard

`/dashboard` apresenta, sempre limitado ao escopo do usuário:

- total de clientes;
- vencidos;
- vencimentos nos próximos 7, 15 e 30 dias;
- em renovação;
- renovados no mês.

A tabela de próximos vencimentos mostra cliente, documento, tipo, vencimento, dias restantes, responsável e status, ordenada por vencimento crescente.

### RF-12 — Administração da hierarquia

- `/admin/users` gerencia perfis.
- `/admin/hierarchy` apresenta Diretor → Gerente → Coordenador → Líder → Usuário.
- Apenas administradores reorganizam a hierarquia.
- Mudanças de perfil, nível, gestor e permissão geram auditoria.
- O servidor rejeita ciclos, auto-gestão e relações incompatíveis com os níveis.

### RF-13 — Administração da integração

`/admin/integrations` mostra status do Acessórias, últimas sincronizações, quantidades e último erro. Permite testar conexão e sincronizar clientes, usuários, solicitações ou tudo. Cada ação é server-side, autorizada e protegida contra execução concorrente do mesmo tipo.

### RF-14 — Auditoria

- `/admin/audit` filtra por usuário, ação, entidade e período.
- A tabela mostra data/hora, usuário, ação, entidade e registro.
- O detalhe mostra `old_data` e `new_data`.
- Registrar criação/edição de vencimento, renovação, cancelamento, exclusão lógica e mudanças de responsável, usuário, hierarquia ou permissões.
- O log é append-only para usuários da aplicação.

### RF-15 — Lembretes

- Ao abrir o app, um popup lista os vencimentos vigentes (`ACTIVE`/`RENEWING`) sob responsabilidade do usuário cujo lembrete já começou (vencimento − X dias ≤ hoje), inclusive os já vencidos, até 50, os mais próximos primeiro.
- Só o responsável vê os próprios lembretes.
- Ao fechar, o popup não volta na mesma sessão do navegador; volta após novo login ou ao reabrir o navegador.

## 5. Rotas

| Rota | Acesso | Finalidade |
| --- | --- | --- |
| `/login` | Público | Autenticação. |
| `/dashboard` | Usuário ativo | Indicadores do escopo. |
| `/clients` | Usuário ativo | Carteira visível. |
| `/clients/[id]` | Acesso ao cliente | Detalhe do cliente. |
| `/clients/[id]/expirations/new` | Edição no cliente | Novo vencimento. |
| `/expirations` | Usuário ativo | Acompanhamento. |
| `/expirations/[id]` | Acesso ao vencimento | Detalhe. |
| `/expirations/[id]/renew` | Edição no vencimento | Renovação. |
| `/admin` e subrotas | Administrador | Usuários, hierarquia, integração e auditoria. |

## 6. Requisitos não funcionais

### Segurança

- Aplicar RLS em todas as tabelas operacionais.
- Calcular o escopo no banco, sem aceitar IDs enviados pelo cliente como prova de acesso.
- Rejeitar acesso cruzado por UUID, URL, REST ou chamada Supabase direta.
- Manter tokens somente em variáveis server-side e nunca registrá-los.

### Desempenho

- Paginação, ordenação e filtros server-side.
- Debounce em busca textual, índices, TanStack Query e cache.
- Consultas seletivas; evitar `select *` quando desnecessário.
- Nunca buscar todas as empresas do Acessórias ao abrir uma tela.

### Interface

- Visual corporativo, minimalista, moderno, claro, sóbrio e orientado à produtividade.
- Prioridade para desktop 1366×768+, com responsividade para notebooks e tablets.
- Sidebar fixa e header no desktop; menus administrativos somente quando autorizados.
- Operações assíncronas têm loading, success, error e empty state; usar skeletons quando apropriado.
- Datas na interface em `dd/MM/yyyy`.

### Observabilidade

- Centralizar logs de aplicação e integração.
- Registrar sincronizações em `legal_sync_logs`.
- Não usar `console.log` indiscriminadamente em produção.

## 7. Critérios de aceite

### Autenticação

- Usuário válido e ativo autentica e mantém sessão; usuário inativo é bloqueado.
- Logout encerra a sessão e rotas privadas rejeitam requisições sem sessão válida.

### Clientes e escopo

- Cliente é sincronizado com responsável da Legalização.
- USER vê a própria carteira; gestores veem sua árvore; DIRECTOR e ADMIN veem todos.
- Busca e paginação são server-side.
- USER A recebe `ACCESS DENIED` ao acessar cliente exclusivo do USER B por URL, UUID, API ou Supabase REST.

### Vencimentos

- Usuário autorizado cadastra e consulta; dados inválidos são rejeitados no cliente e servidor.
- Dias restantes respeitam `America/Sao_Paulo` e vencidos independem de job diário.
- Filtros e paginação são server-side.
- Renovação mantém o anterior e cria o novo atomicamente; a cadeia permanece íntegra.

### Solicitações

- Solicitações são sincronizadas, relacionadas ao cliente e limitadas ao escopo.
- Detalhe, timeline e anexos aparecem quando disponíveis.
- Nenhuma ação modifica solicitações no Acessórias.

### Administração e auditoria

- Somente ADMIN acessa rotas e operações administrativas.
- Mudanças de usuário/hierarquia rejeitam estruturas inválidas.
- Operações auditáveis registram autor, entidade, estado anterior e novo estado.

## 8. Fluxos esperados

Operacional: Login → Dashboard → Meus Clientes → Cliente → Novo vencimento → Acompanhamento → Iniciar renovação → Concluir renovação → Histórico.

Solicitações: Cliente → Solicitações → dado do Acessórias → Detalhe → Timeline e anexos.

Administrativo: Usuários → Hierarquia → Integrações → Auditoria.
