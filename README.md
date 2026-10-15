# Controle de Vencimentos — Legalização

Aplicação web interna para controlar certidões, licenças e certificados dos clientes do departamento de Legalização. A carteira de clientes, seus responsáveis e suas solicitações vêm do Sistema Acessórias. O acesso respeita a hierarquia organizacional e é protegido por Row Level Security no Supabase.

## Estado do projeto

Fase 0 (setup) concluída: Next.js 16 com App Router e TypeScript estrito, Tailwind CSS 4, shadcn/ui, ESLint, Prettier, Vitest e validação de variáveis de ambiente. As próximas fases seguem a ordem de `docs/DEVELOPMENT.md`.

## Como executar

Requer Node.js 24 e npm.

```bash
npm ci
cp .env.example .env.local   # preencher os valores
npm run dev                   # http://localhost:3000
```

| Script | Finalidade |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e execução de produção |
| `npm run typecheck` | Gera tipos de rotas e roda `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Testes (Vitest), execução única |
| `npm run format` / `format:check` | Prettier |

Antes de cada commit: `npm run typecheck && npm run lint && npm test && npm run format:check && npm run build`.

## Stack obrigatória

- Next.js com App Router, React e TypeScript estrito
- Tailwind CSS, shadcn/ui e Lucide Icons
- TanStack Query, React Hook Form e Zod
- Supabase Auth e PostgreSQL/RLS no projeto corporativo existente
- Sistema Acessórias como integração externa server-side

## Documentação

- [Requisitos do produto](docs/SRS.md)
- [Banco de dados](docs/DATABASE.md)
- [Integração Acessórias](docs/ACESSORIAS.md)
- [Autorização e RLS](docs/AUTHORIZATION.md)
- [Desenvolvimento e qualidade](docs/DEVELOPMENT.md)
- [Instruções para agentes](CLAUDE.md)

## Restrições centrais

Não criar outro Supabase, não modificar objetos de outros sistemas, não expor secrets, não usar service role no browser e não confiar no frontend para autorização. Todos os objetos deste sistema usam o namespace `legal_`.
