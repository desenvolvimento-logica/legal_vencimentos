# Prompt set dos mockups

Os mockups foram gerados com a ferramenta integrada de geração de imagens, no modo `ui-mockup`. O logo fornecido pelo escritório foi usado como referência de marca, não como alvo de redesenho.

## Prompt-base

```text
Use case: ui-mockup
Asset type: high-fidelity desktop web application screen, 16:9
Input images: the supplied office logo is the exact brand reference; preserve its white and golden-yellow identity and do not redesign it
Primary request: create an implementation-ready screen for the internal Brazilian-Portuguese application "Controle de Vencimentos — Legalização"
Style/medium: realistic shippable enterprise SaaS UI; corporate, minimal, modern, sober and accessible; practical shadcn-style components; not concept art
Composition/framing: 1366x768 desktop; fixed 232px deep-navy sidebar; white top header; off-white content canvas; subtle 1px borders and small shadows
Canonical navigation: Dashboard, Clientes, Vencimentos, Administração; administrative submenu Usuários, Hierarquia, Integrações, Auditoria
Color palette: deep navy #101827; golden yellow #F4C400; off-white #F7F8FA; white cards; slate text; restrained semantic red, orange, amber, blue, green and gray
Constraints: readable Brazilian Portuguese; practical production layout; use the supplied logo once; no gradients; no glassmorphism; no stock photography; no browser chrome; no watermark; do not invent product features
```

## Variações por tela

### Login

```text
Split layout: 42% navy institutional panel and 58% off-white login area. Show the logo, product name and short description on the left. On the right, a centered card with E-mail, Senha, Entrar and the authorized-access note.
```

### Dashboard

```text
Show seven scoped metric cards, a Próximos vencimentos table ordered by date and a secondary Distribuição por tipo donut chart. Use icons, text and semantic colors together.
```

### Clientes

```text
Title Meus Clientes, server-side filters for Razão Social, Nome Fantasia and CNPJ, and a paginated table with responsible person, active expirations, next expiration and overdue count.
```

### Detalhe e novo vencimento

```text
Show client identity, metadata, tabs, summary cards and an expirations table. Open a 460px right drawer titled Novo vencimento with all SRS fields, required markers and Cancelar/Salvar vencimento actions.
```

### Vencimentos

```text
Combine search, type/status/date filters, quick ranges for overdue and 7/15/30/60 days, and a server-side table with semantic status badges and row actions.
```

### Integrações

```text
Admin screen with Acessórias connection status, the exact endpoint https://api.acessorias.com, cards for Clientes/Usuários/Solicitações and a synchronization log table with RUNNING, SUCCESS, PARTIAL and FAILED states.
```

### Renovação

```text
Compare the immutable current record with the form for the new record, linked by a directional cue. Show the renewal chain as a timeline and explain that the current record becomes Renovado and remains in history.
```

### Solicitações

```text
Client tab with explicit Somente leitura badge, request filters/table and a right detail panel containing metadata, interaction timeline and downloadable attachments. Do not show create, edit, comment, finish or upload controls.
```

### Usuários

```text
Admin metrics, filters and paginated user table. Open an Editar usuário drawer with cargo, hierarchy level, manager and active switch. Do not show physical deletion or unapproved user-creation controls.
```

### Hierarquia

```text
Connected organization tree from DIRECTOR to USER, searchable and expandable. Show a Vínculo hierárquico inspector with scope-impact warning. Avoid decorative genealogy styling and prevent visual suggestions of cycles.
```

### Auditoria

```text
Append-only event table with user/action/entity/date filters and a right detail drawer showing metadata plus old_data/new_data as a readable red/green diff. Do not show edit, delete or export controls.
```

## Regra para edições

Ao corrigir uma imagem, usar edição localizada: declarar a imagem como alvo, indicar exatamente o elemento a mudar e exigir que todo o restante — layout, textos, cores, espaçamento e composição — permaneça inalterado.
