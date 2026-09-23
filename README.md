# Finanças

Inteligência financeira pessoal e familiar: cartões, faturas, contas recorrentes, parcelamentos, orçamento, renda e um assistente com IA, com cálculos rastreáveis até o documento de origem.

Multi-organização desde o início: uma família (ou equipe) compartilha uma organização, administradores veem tudo e cada membro vê o que é seu. Nenhum dado atravessa organizações.

> **Estado atual: Fase 0 (fundação).** Login com Google ou e-mail, verificação em duas etapas obrigatória, organizações, membros, convites, auditoria e isolamento testado no banco. Lançamentos financeiros chegam na Fase 1. Veja o [roadmap](docs/roadmap.md).

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres, Auth, RLS) · Vitest + PGlite · Vercel

Detalhes em [docs/arquitetura.md](docs/arquitetura.md) e [docs/seguranca.md](docs/seguranca.md).

## Rodando pela primeira vez

### 1. Pré-requisitos

- Node.js 20.9 ou superior (recomendado 22)
- Conta no [Supabase](https://supabase.com) e na [Vercel](https://vercel.com)
- Projeto no [Google Cloud Console](https://console.cloud.google.com) para o login com Google

### 2. Dependências

```bash
npm install
```

### 3. Banco no Supabase

1. Crie um projeto no Supabase (região `South America (São Paulo)`).
2. Vincule e aplique as migrações:

```bash
npx supabase login
npm run db:link -- --project-ref SEU_PROJECT_REF
npm run db:push
```

3. (Opcional) Regenere os tipos a partir do banco real: `npm run db:types`.

### 4. Login com Google

1. Google Cloud Console > APIs e serviços > Credenciais > Criar ID do cliente OAuth (Aplicativo da Web).
2. URI de redirecionamento autorizado: `https://SEU_PROJECT_REF.supabase.co/auth/v1/callback`.
3. No Supabase: Authentication > Providers > Google, cole o Client ID e o Client Secret.

### 5. Autenticação no Supabase

Em Authentication:

- **Providers > Email:** confirmação de e-mail ligada.
- **Multi-Factor:** App Authenticator (TOTP) habilitado.
- **Passwords:** mínimo de 12 caracteres.
- **URL Configuration:** Site URL `http://localhost:3000` e, em Redirect URLs, `http://localhost:3000/auth/callback` (adicione também a URL de produção).

### 6. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project Settings > API Keys, chave **publishable**). Nunca use a chave secreta no app.

### 7. Rodar

```bash
npm run dev
```

Abra http://localhost:3000, crie a conta, cadastre o autenticador e crie a sua organização.

## Deploy na Vercel

1. Importe o repositório na Vercel.
2. Configure as mesmas variáveis do `.env.local`, com `NEXT_PUBLIC_APP_URL` apontando para o domínio de produção.
3. No Supabase, adicione `https://SEU-DOMINIO/auth/callback` às Redirect URLs e ajuste a Site URL.

Antes de guardar dados reais, use plano pago no Supabase (backups diários e sem pausa por inatividade).

## Scripts

| Comando                  | O que faz                                                       |
| ------------------------ | --------------------------------------------------------------- |
| `npm run dev`            | Servidor de desenvolvimento                                     |
| `npm run check`          | Lint, verificação de tipos e todos os testes                    |
| `npm test`               | Testes unitários e de banco (isolamento, MFA, papéis, convites) |
| `npm run build`          | Build de produção                                               |
| `npm run format`         | Formata o código                                                |
| `npm run db:new -- nome` | Cria uma nova migração                                          |
| `npm run db:push`        | Aplica migrações no projeto vinculado                           |
| `npm run db:types`       | Regenera `src/lib/supabase/database.types.ts`                   |

## Testes de banco

Os testes em `tests/db` sobem um Postgres em memória (PGlite), aplicam um shim do Supabase e todas as migrações, e verificam as regras de acesso como usuários reais. Não precisam de Docker nem de conexão. Toda nova tabela deve entrar nesses testes antes de ir para produção.

## Convenções

- Todo acesso a dados passa por `requireMfaSession()` e pelo RLS; nunca use a chave secreta no app web.
- Escritas sensíveis são funções no banco, com auditoria.
- Regras de negócio ficam em `src/modules/<contexto>/domain`, testadas sem framework.
- Valores em centavos inteiros. Nada de ponto flutuante para dinheiro.
- README e `docs/` atualizados a cada mudança relevante.
