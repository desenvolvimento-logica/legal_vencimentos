# CLAUDE.md — Controle de Vencimentos da Legalização

Este arquivo contém regras obrigatórias para qualquer agente que altere este repositório.

## Leitura obrigatória

Antes de qualquer tarefa substancial:

1. Leia `docs/SRS.md`.
2. Leia o documento técnico relacionado à tarefa:
   - banco: `docs/DATABASE.md`;
   - Acessórias: `docs/ACESSORIAS.md`;
   - autenticação, hierarquia ou RLS: `docs/AUTHORIZATION.md`;
   - setup, arquitetura, testes ou entrega: `docs/DEVELOPMENT.md`.
3. Inspecione código, tipos e migrations existentes.
4. Faça um plano curto e implemente somente o escopo solicitado.

Em caso de conflito, a prioridade é: solicitação atual do usuário, `docs/SRS.md`, documento técnico específico, código existente. Não invente requisitos para preencher lacunas.

## Regras inegociáveis

- Use Next.js, React, App Router e TypeScript com `strict: true`.
- Não use `any` indiscriminadamente. Valide fronteiras externas com Zod.
- Use o Supabase corporativo existente, project ref `olyvjnqmrzkziirzbmhi`. Nunca crie outro projeto Supabase.
- Todo objeto exclusivo do sistema deve usar o prefixo `legal_`; Edge Functions usam `legal-`.
- Toda alteração estrutural deve ter migration em `supabase/migrations/`.
- Antes de criar uma migration, inspecione o schema e confirme que o objeto não existe.
- Nunca apague ou altere objetos de outros sistemas, resete banco/Auth, remova policies existentes ou execute migration destrutiva.
- Preserve RLS. Nunca a desabilite ou relaxe apenas para fazer uma funcionalidade funcionar.
- Filtros no React não são autorização. A regra de escopo deve ser aplicada no servidor e no banco.
- Nunca importe o cliente service role em código que possa chegar ao browser.
- Nunca exponha ou registre senhas, access tokens, refresh tokens, service role key ou token do Acessórias.
- `ACESSORIAS_API_TOKEN` existe somente no servidor. Componentes React não acessam `api.acessorias.com`.
- Clientes, responsáveis e solicitações têm o Acessórias como fonte oficial.
- Solicitações do Acessórias são somente leitura nesta versão.
- Renovação cria um novo vencimento e preserva o anterior; nunca sobrescreva o histórico.
- Use exclusão lógica onde especificado. Não remova registros com histórico durante a operação normal.
- Não use mocks como implementação final.
- Não assuma endpoints ou formatos da API do Acessórias que não estejam documentados ou comprovados.

## Fluxo de conclusão

Antes de considerar uma tarefa pronta:

1. execute typecheck e lint;
2. execute os testes relevantes;
3. confirme que RLS e escopo continuam corretos;
4. verifique estados de loading, erro, sucesso e vazio nas operações assíncronas alteradas;
5. confirme que nenhum secret foi versionado;
6. atualize a documentação afetada.

Registre limitações ou dúvidas que exigem decisão em `docs/DEVELOPMENT.md`, na seção “Questões em aberto”.
