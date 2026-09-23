<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Convenções do projeto

- Leia `README.md` e `docs/` antes de alterar algo. Mantenha ambos atualizados a cada mudança relevante.
- Segurança em camadas: `proxy.ts` (otimista), `requireMfaSession()` em toda página e Server Action, RLS no banco.
- Toda tabela nova: `org_id not null`, RLS habilitado, política restritiva `mfa_required`, sem acesso para `anon`, e testes em `tests/db`.
- Dados financeiros usam `private.can_access_owned(org_id, owner_id)`: administradores veem tudo, membros veem o que é seu.
- Escritas sensíveis por funções `SECURITY DEFINER` com `set search_path = ''`, validação explícita, lock da organização antes de ler papéis e auditoria.
- Toda função nova em `private` exige `revoke ... from public, anon, authenticated`; o teste de lista permitida em `tests/db` garante isso.
- Erros de regra de negócio usam SQLSTATE da classe `FA` (FA401, FA403, FA404, FA409, FA422); só esses chegam ao usuário.
- Tabelas financeiras usam chaves estrangeiras compostas `(org_id, id)` para impedir referência entre organizações.
- Dinheiro em centavos (`bigint`). Nunca ponto flutuante.
- Mensagens de commit e descrições de PR sem qualquer atribuição de IA.
