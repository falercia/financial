# Arquitetura

## Visão geral

| Camada       | Tecnologia                                    | Responsabilidade                               |
| ------------ | --------------------------------------------- | ---------------------------------------------- |
| Interface    | Next.js 16 (App Router), React 19, Tailwind 4 | Telas, formulários, navegação                  |
| Aplicação    | Server Components e Server Actions            | Casos de uso, validação com zod, autorização   |
| Domínio      | TypeScript puro em `src/modules/*/domain`     | Regras de negócio sem dependência de framework |
| Dados        | Supabase Postgres com RLS                     | Persistência, isolamento, auditoria            |
| Autenticação | Supabase Auth                                 | Google, e-mail e senha, MFA TOTP               |
| Hospedagem   | Vercel + Supabase                             | Deploy, previews por PR, banco gerenciado      |

## Organização do código

```
src/
  app/                      Rotas (URLs em português)
    (auth)/                 entrar, cadastro, mfa
    (onboarding)/           boas-vindas, convite/[token]
    (app)/                  área logada com menu lateral
    auth/callback/          retorno do Google e dos links de e-mail
  components/               Componentes visuais compartilhados
  lib/                      Infraestrutura (env, clientes Supabase, utilitários)
  modules/<contexto>/
    domain/                 Regras puras e testáveis
    application/            Sessão, consultas e Server Actions
    ui/                     Componentes do contexto
  proxy.ts                  Renovação de sessão e redirecionamento otimista
supabase/migrations/        Schema versionado (fonte única da verdade)
tests/db/                   Testes do banco (RLS, funções, isolamento)
```

Contextos previstos: `identity` (pronto), `ledger` (lançamentos), `cards`, `recurrences`, `installments`, `budget`, `income`, `imports`, `insights`, `ai`, `messaging` (WhatsApp).

## Fluxo de uma requisição

1. `proxy.ts` renova os tokens de sessão e manda para `/entrar` ou `/mfa` quem não pode seguir. É só uma checagem otimista.
2. A página ou a Server Action chama `requireMfaSession()`, que valida a assinatura do JWT (`getClaims`) e exige `aal2`.
3. As consultas usam o cliente Supabase com o JWT do próprio usuário. O Postgres aplica RLS em cada linha.
4. Escritas sensíveis chamam funções do banco (`create_invitation`, `accept_invitation` etc.), que validam permissão, gravam auditoria e mantêm invariantes, como "sempre existe um proprietário".

Cada camada assume que a anterior pode falhar. Uma rota esquecida no proxy continua protegida pela camada de sessão; uma consulta mal escrita continua limitada pelo RLS.

## Multi-organização e visibilidade

- Uma pessoa pode pertencer a várias organizações e escolhe a ativa no menu. O cookie da organização ativa é só preferência: o acesso é sempre conferido no banco.
- Papéis: `owner` (proprietário), `admin` (administrador) e `member` (membro).
- Regra dos dados financeiros, a partir da Fase 1: administradores veem tudo da organização; membros veem apenas o que é deles. Implementada pela função `private.can_access_owned(org_id, owner_id)`, já testada.
- Planos futuros por quantidade de pessoas: `organizations.plan` e `organizations.seat_limit`, alteráveis só pelo backend. Convites respeitam o limite, contando convites pendentes.

## Dinheiro

Valores financeiros serão armazenados em centavos (`bigint`), nunca em ponto flutuante. Totais mensais por organização serão mantidos numa tabela de fatos atualizada a cada escrita, para o dashboard responder rápido com muitos usuários.

## Decisões registradas

| Decisão                                           | Motivo                                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Supabase CLI e migrações SQL como fonte do schema | RLS, funções e gatilhos são SQL; um ORM esconderia exatamente o que precisa ser revisado |
| Tipos do banco gerados (`npm run db:types`)       | Consultas tipadas sem manter modelos duplicados                                          |
| Testes de banco com PGlite                        | Rodam em segundos, sem Docker, no CI e em qualquer máquina                               |
| Escritas por funções `SECURITY DEFINER`           | Regras de permissão e auditoria ficam atômicas e no mesmo lugar                          |
| Auditoria somente de inclusão                     | Gatilho bloqueia UPDATE, DELETE e TRUNCATE para qualquer papel                           |
| Chaves de IA por organização (BYOK)               | Cada organização controla custo e destino dos dados                                      |
