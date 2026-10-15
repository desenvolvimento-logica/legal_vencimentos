# Mockups e sistema visual

## 1. Finalidade e autoridade

Os mockups em `docs/mockups/` são a referência criativa para a implementação. Eles definem linguagem visual, hierarquia, densidade, composição e comportamento esperado dos componentes.

O conjunto reutilizável de prompts está em `MOCKUP-PROMPTS.md` para futuras variações ou regenerações.

Regras funcionais, permissões, campos e estados descritos em `SRS.md`, `DATABASE.md` e `AUTHORIZATION.md` têm precedência sobre textos ou dados ilustrativos presentes nas imagens. Nomes, números e datas das linhas são fictícios. Não criar funcionalidades apenas porque um detalhe decorativo apareceu no mockup.

## 2. Arquivos

| Arquivo | Rota/fluxo | Referência principal |
| --- | --- | --- |
| `mockups/01-login.png` | `/login` | Composição da autenticação e uso institucional da marca. |
| `mockups/02-dashboard.png` | `/dashboard` | Shell principal, métricas, tabela e gráfico. |
| `mockups/03-clients.png` | `/clients` | Filtros, tabela, paginação e densidade. |
| `mockups/04-client-detail-new-expiration.png` | `/clients/[id]` + novo vencimento | Cabeçalho do cliente, abas, resumo e drawer de formulário. |
| `mockups/05-expirations.png` | `/expirations` | Filtros avançados, atalhos de período, estados e ações. |
| `mockups/06-admin-integrations.png` | `/admin/integrations` | Navegação administrativa, cartões de sync e logs. |
| `mockups/07-expiration-renewal.png` | `/expirations/[id]/renew` | Comparação entre registro atual e novo, cadeia histórica e conclusão. |
| `mockups/08-client-requests.png` | Aba Solicitações de `/clients/[id]` | Lista somente leitura, detalhe, timeline e anexos. |
| `mockups/09-admin-users.png` | `/admin/users` | Indicadores, filtros, tabela e edição de perfil. |
| `mockups/10-admin-hierarchy.png` | `/admin/hierarchy` | Árvore organizacional e alteração de vínculo. |
| `mockups/11-admin-audit.png` | `/admin/audit` | Filtros, eventos e comparação de dados. |
| `mockups/logo-reference.png` | Marca | Referência original fornecida pelo escritório. |

O asset da aplicação deve ser lido de `public/brand/logo-white-yellow.png`.

## 3. Direção visual

- Corporativa, minimalista, moderna, clara e sóbria.
- Alta densidade informacional sem aparência apertada.
- Fundo geral frio e claro; superfícies brancas delimitadas por borda discreta.
- Sidebar escura para valorizar o logo branco/amarelo.
- Amarelo reservado à marca, seleção e ações primárias; não usar em grandes áreas de conteúdo.
- Cores semânticas reservadas a estados. Todo estado combina cor, texto e ícone.
- Cantos moderados, sombras pequenas e ausência de efeitos decorativos pesados.
- Sem gradientes, glassmorphism, ilustrações genéricas ou fotografia de banco de imagens.

## 4. Tokens de cor

| Token sugerido | Valor | Uso |
| --- | --- | --- |
| `--brand-navy-950` | `#101827` | Sidebar e áreas institucionais escuras. |
| `--brand-navy-900` | `#172236` | Hover/seleção escura. |
| `--brand-gold-500` | `#F4C400` | Ação primária, item ativo e foco de marca. |
| `--brand-gold-600` | `#DFAF00` | Hover da ação primária. |
| `--background` | `#F7F8FA` | Fundo da aplicação. |
| `--surface` | `#FFFFFF` | Cards, tabelas, drawer e header. |
| `--foreground` | `#0F172A` | Texto principal. |
| `--muted-foreground` | `#64748B` | Texto secundário. |
| `--border` | `#E2E8F0` | Bordas e divisores. |
| `--success` | `#168A4B` | Renovado/sucesso. |
| `--warning` | `#B77900` | Atenção e sincronização parcial. |
| `--danger` | `#D92D3A` | Vencido, falha e ação destrutiva. |
| `--info` | `#1769C2` | Em renovação/em execução. |

Usar fundos semânticos claros com contraste adequado, por exemplo vermelho muito claro + texto vermelho escuro. Nunca usar amarelo da marca como texto pequeno sobre branco.

## 5. Tipografia

Preferência: Geist Sans, já alinhada ao ecossistema Next.js; fallback `Inter, ui-sans-serif, system-ui`.

| Elemento | Tamanho/peso sugerido |
| --- | --- |
| Título da página | 32 px / 700, line-height 1.2 |
| Título do card/drawer | 20–24 px / 650–700 |
| Métrica | 32–40 px / 700 |
| Corpo | 14 px / 400–500 |
| Label de campo | 14 px / 600 |
| Tabela | 13–14 px / 400–600 |
| Texto auxiliar | 12 px / 400 |

Manter títulos curtos e alinhados à esquerda. Usar tabular numbers em datas, contadores e durações quando disponível.

## 6. Grid e shell

Desktop de referência: 1366×768 ou maior.

- Sidebar fixa: 232–240 px.
- Header fixo: 64–68 px.
- Conteúdo: padding de 24–32 px.
- Grid base: 8 px.
- Espaços usuais: 8, 12, 16, 24 e 32 px.
- Card: raio 10–12 px, borda 1 px, sombra curta e muito discreta.
- Altura de inputs/botões: 40–44 px.
- Linhas de tabela: 52–56 px.

O shell autenticado deve ser único e reutilizado. A sidebar exibe:

```text
Dashboard
Clientes
Vencimentos
Administração
  Usuários
  Hierarquia
  Integrações
  Auditoria
```

Itens administrativos só aparecem para ADMIN. O item atual usa fundo dourado e texto navy; hover sem seleção usa navy mais claro.

## 7. Logo

- Usar o arquivo original sem redesenhar, recolorir, distorcer ou reconstruir o símbolo.
- Aplicar sobre fundo navy, respeitando área de respiro de pelo menos a altura do elemento circular do símbolo.
- Manter proporção; usar `object-fit: contain`.
- Não colocar o logo branco sobre fundo claro.
- Na sidebar, limitar a largura pelo espaço interno e não deixar o logo competir com a navegação.
- Na tela de login, pode receber maior presença institucional no painel escuro.

## 8. Componentes

### Botões

- Primário: fundo dourado, texto navy, ícone opcional à esquerda.
- Secundário: branco, borda slate, texto navy.
- Perigoso: vermelho somente para ações destrutivas confirmadas.
- Estado loading preserva largura e mostra spinner; desabilitar duplo envio.
- Foco visível com ring de alto contraste.

### Filtros

- Agrupar em card antes da tabela.
- Campo de busca é o elemento mais largo.
- Selects e datas mantêm largura estável.
- Atalhos de período funcionam como chips/botões de alternância.
- “Limpar filtros” tem menor ênfase visual.
- Em telas estreitas, quebrar os campos em linhas sem reduzir área de clique.

### Tabelas

- Cabeçalho com fundo cinza muito claro e texto semibold.
- Ordenação indicada junto ao título da coluna.
- Ações na última coluna, com botão de detalhe e menu quando necessário.
- Manter texto principal e informação secundária na mesma célula quando melhora a leitura, como cliente + CNPJ.
- Paginação sempre visível abaixo dos resultados.
- Skeleton preserva a largura das colunas.
- Empty state ocupa o corpo da tabela e oferece ação relevante.

### Badges de estado

| Estado | Cor | Ícone sugerido |
| --- | --- | --- |
| Vencido/Falha | Vermelho | Triângulo de alerta ou X. |
| 0–7 dias | Laranja/vermelho | Relógio ou alerta. |
| 8–15 dias/Parcial | Âmbar | Relógio ou exclamação. |
| 16–30 dias | Azul | Calendário. |
| Em renovação/Executando | Azul | Setas circulares/spinner. |
| Renovado/Sucesso | Verde | Check. |
| Cancelado | Cinza | Círculo com traço. |

### Drawer de formulário

- Desktop: painel direito de 440–480 px, overlay sutil sobre o conteúdo.
- Header e footer fixos; corpo rolável.
- Campos obrigatórios marcados por asterisco e mensagem contextual.
- Ações “Cancelar” e primária permanecem visíveis no footer.
- Em tablet/mobile, ocupar a largura total.

### Estados assíncronos

- Loading inicial: skeletons, sem tela vazia.
- Refetch: preservar dados e mostrar indicador discreto.
- Erro: mensagem clara, motivo sanitizado e ação “Tentar novamente”.
- Vazio: explicar ausência e oferecer cadastro ou limpeza de filtros.
- Sucesso de mutação: toast curto e atualização imediata dos dados afetados.

## 9. Especificação por tela

### Login

Painel institucional navy à esquerda e card de login à direita. Em viewport estreito, remover a divisão e manter logo compacto acima do card. Campos: e-mail e senha; ação principal “Entrar”. A recuperação de senha só deve ser funcional se o fluxo for implementado; caso contrário, não exibir link inativo.

### Dashboard

Primeira dobra contém título, data operacional, sete métricas e tabela de próximos vencimentos. Em 1366 px, os sete cards podem usar uma grade compacta; abaixo disso, quebrar em 4+3 ou carrossel não é desejável. O gráfico de distribuição é secundário e pode descer abaixo da tabela.

### Clientes

Filtros por razão social, nome fantasia e CNPJ acima da tabela. Linhas levam ao detalhe do cliente. “Atualizar” recarrega o cache da consulta; não deve disparar sincronização completa do Acessórias para usuário comum.

### Detalhe do cliente

Header com identidade e metadados, abas e indicadores. “Novo vencimento” abre drawer mantendo o contexto visível. As abas são Visão Geral, Vencimentos, Solicitações e Histórico. Solicitações continuam somente leitura.

### Vencimentos

Busca e filtros combináveis, com chips de períodos rápidos. O status visual calculado pode mostrar “Vencido” mesmo que o banco ainda tenha `ACTIVE`. A ação principal de novo vencimento deve exigir escolha de cliente se aberta fora do detalhe.

### Renovação

Mostrar o registro imutável atual ao lado dos campos do sucessor e explicitar que o anterior permanecerá no histórico. A linha do tempo permite conferir a cadeia antes de concluir. A ação “Concluir renovação” só fica habilitada após validação e deve apresentar loading até a transação atômica terminar.

### Solicitações do cliente

A aba combina tabela e painel de detalhe. O badge “Somente leitura” precisa ser visível. Timeline e anexos podem ser consultados, mas a interface não oferece criação, edição, comentário, conclusão ou upload.

### Administração — Usuários

Indicadores resumem ativos, inativos, gestores e perfis sem gestor. A edição acontece em drawer e não permite apagar fisicamente. O e-mail exibido no mockup é ilustrativo; a origem e editabilidade devem seguir a implementação de Auth/perfil. Alterações de nível, gestor e status mostram aviso de auditoria.

### Administração — Hierarquia

A árvore torna relações e níveis visíveis sem depender apenas de cores. Alterar um vínculo abre painel de contexto, alerta sobre impacto no escopo e exige confirmação. O servidor continua responsável por rejeitar ciclos e relações inválidas.

### Administração — Integrações

Exibe conectividade, cartões por tipo de sync e histórico. Ações pedem confirmação quando uma sincronização for custosa, apresentam progresso e impedem duplicidade. `RUNNING`, `SUCCESS`, `PARTIAL` e `FAILED` aparecem com ícone, texto e cor.

### Administração — Auditoria

Filtros e tabela ficam lado a lado com o detalhe do evento em desktop. `old_data` e `new_data` usam apresentação de diff legível, mas continuam dados somente leitura. Não oferecer edição, exclusão nem exportação sem requisito posterior explícito.

## 10. Responsividade

- Desktop ≥ 1280 px: sidebar expandida, métricas em linha e tabelas completas.
- Tablet 768–1279 px: sidebar recolhível, cards em 2–4 colunas e tabelas com scroll horizontal controlado.
- Mobile < 768 px: navegação em sheet, cards em uma coluna, filtros em drawer e dados essenciais em cards/lista quando a tabela ficar ilegível.
- Não ocultar informações críticas apenas para caber; oferecer detalhe acessível.

## 11. Acessibilidade

- Contraste WCAG AA para texto e controles.
- Navegação integral por teclado.
- Foco visível e ordem de tabulação coerente.
- Ícones decorativos com `aria-hidden`; botões só com ícone têm nome acessível e tooltip.
- Erros de formulário associados ao campo.
- Tabelas usam cabeçalhos semânticos e estado de ordenação acessível.
- Badges nunca dependem apenas da cor.
- Movimento reduzido respeita `prefers-reduced-motion`.

## 12. Orientação de implementação

Use os mockups para composição e estética, mas construa componentes reais com Tailwind e shadcn/ui. Não use as imagens como fundo da aplicação. Preserve os tokens em CSS variables e centralize variantes de status para evitar cores divergentes entre dashboard, tabelas e detalhes.
