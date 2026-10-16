# Controle de Vencimentos — Legalização

Aplicação web interna para controlar certidões, licenças e certificados dos clientes do departamento de Legalização. A carteira de clientes, seus responsáveis e suas solicitações vêm do Sistema Acessórias. O acesso respeita a hierarquia organizacional e é protegido por Row Level Security no Supabase.

## Estado do projeto

Fases 0 a 9 implementadas: autenticação Microsoft, banco com RLS, sincronização com o Acessórias, clientes, vencimentos, solicitações, administração e dashboard. O andamento de cada fase está em `docs/DEVELOPMENT.md`.

Produção: https://legal-vencimentos.vercel.app (deploy automático a cada push no `main`).

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
| `npm run db:bundle` | Gera `supabase/apply/legal_apply.sql` para o SQL Editor |
| `npm run db:types` | Regenera `src/types/database.ts` a partir das migrations |
| `npm run sync -- <tipos> [--full]` | Sincroniza com o Acessórias via servidor local (`npm run dev`) |

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
- [Mockups e sistema visual](docs/UI-MOCKUPS.md)
- [Desenvolvimento e qualidade](docs/DEVELOPMENT.md)
- [Instruções para agentes](CLAUDE.md)

## Restrições centrais

Não criar outro Supabase, não modificar objetos de outros sistemas, não expor secrets, não usar service role no browser e não confiar no frontend para autorização. Todos os objetos deste sistema usam o namespace `legal_`.
