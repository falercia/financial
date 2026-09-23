# Segurança

## Princípios

1. **Defesa em camadas.** Proxy, camada de sessão no servidor e RLS no banco. Nenhuma camada confia na anterior.
2. **MFA obrigatório.** Sem segundo fator verificado (`aal2`), nenhuma tabela retorna linhas e nenhuma operação executa. A regra está no banco, numa política restritiva em cada tabela.
3. **Isolamento entre organizações.** Toda linha pertence a uma organização. O banco só devolve linhas das organizações do usuário.
4. **Menor privilégio.** O papel `anon` não tem acesso a nenhuma tabela. O papel `authenticated` só lê; toda escrita passa por funções que validam permissão.
5. **Nada de segredo no navegador.** O app usa apenas a chave pública (publishable). A chave secreta do Supabase nunca é usada no código da aplicação web.

## O que está implementado

| Controle                                                                                                     | Onde                                                  |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Login com Google (OAuth PKCE) e e-mail e senha                                                               | `modules/identity/application/auth-actions.ts`        |
| Senha mínima de 12 caracteres, e-mail confirmado                                                             | Supabase Auth + validação com zod                     |
| MFA TOTP obrigatório, com cadastro guiado                                                                    | `/mfa`, `mfa-actions.ts`, política `mfa_required`     |
| Verificação do JWT em toda página e ação                                                                     | `requireMfaSession()` com `getClaims()`               |
| RLS em todas as tabelas                                                                                      | `supabase/migrations`                                 |
| Convites com token de 256 bits, guardado só como hash SHA-256, válido por 7 dias e preso ao e-mail convidado | `create_invitation`, `accept_invitation`              |
| Mesma resposta para convite inexistente, expirado ou de outro e-mail                                         | `accept_invitation`                                   |
| Proteção contra redirecionamento aberto                                                                      | `lib/safe-redirect.ts`                                |
| Auditoria imutável                                                                                           | tabela `audit_log` + gatilhos                         |
| Cabeçalhos: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy                                  | `next.config.ts`                                      |
| Mensagens de erro sem detalhes internos                                                                      | `application/result.ts`                               |
| Cookies de sessão `HttpOnly`, `Secure` em produção e `SameSite=Lax`                                          | `lib/supabase/cookie-options.ts`                      |
| Alterações de membros serializadas por organização (sem corrida entre proprietários)                         | `private.lock_organization`                           |
| Convite exige e-mail confirmado na conta e perde validade se quem convidou perder a autoridade               | `accept_invitation`                                   |
| Administrador não cancela nem substitui convite de administrador feito pelo proprietário                     | `create_invitation`, `revoke_invitation`              |
| Renomear organização fica auditado                                                                           | gatilho `organizations_audit_rename`                  |
| Contas podem ser excluídas; exclusão da organização remove todos os seus dados                               | chaves estrangeiras + exceção de cascata na auditoria |
| Apenas erros de regra de negócio (SQLSTATE `FA***`) chegam ao usuário                                        | `application/result.ts`                               |
| Redirecionamentos do callback usam a URL configurada, nunca o cabeçalho Host                                 | `app/auth/callback/route.ts`                          |

## Testes automáticos de segurança

`tests/db/isolation.test.ts` roda a cada push no CI e verifica, entre outros:

- Pessoa de uma organização não lê, altera nem convida em outra.
- Sessão sem MFA não lê nenhuma tabela nem executa operações.
- `anon` não acessa nada.
- Ninguém se insere como membro, altera plano ou forja auditoria.
- Auditoria não pode ser alterada nem pelo dono do banco.
- Hierarquia de papéis e a regra "admin vê tudo, membro vê o seu".
- Convite: só hash armazenado, só o e-mail convidado aceita, revogação, expiração e limite de pessoas.

Os testes foram validados por mutação: ao remover a exigência de MFA de uma tabela ou abrir a leitura da auditoria, eles falham. Um teste de lista permitida garante que nenhuma função interna do schema `private` fique executável por clientes.

## Revisão independente

Uma revisão de segurança independente foi feita sobre a Fase 0. Nenhum caminho de acesso entre organizações nem de contorno do MFA foi encontrado. Os pontos levantados (corrida entre proprietários, cookies legíveis por script, convite sem e-mail confirmado, convites que sobreviviam à perda de autoridade, exclusão de contas bloqueada, renomeação sem auditoria, mensagens internas do banco expostas) foram corrigidos e cobertos por testes.

## Pendências conhecidas (Fase 5)

- CSP com nonce para scripts (hoje `script-src 'self' 'unsafe-inline'`; os cookies `HttpOnly` já impedem o roubo da sessão por script).
- O token do convite passa pelo parâmetro `next` quando a pessoa ainda não entrou; guardar o convite pendente num cookie `HttpOnly` de curta duração.
- Um token de acesso revogado continua válido até expirar (1 hora). Avaliar reduzir `jwt_expiry` e ativar limite de sessão por inatividade no Supabase.
- Procedimento formal de exclusão de conta e de organização (LGPD), incluindo o caso de proprietário único.
- Rate limiting nas ações de login, convite e verificação de código.
- Códigos de recuperação do MFA (a API do Supabase ainda está marcada como experimental).
- Monitoramento de erros sem dados pessoais (Sentry) e alerta de eventos sensíveis.
- Termos de uso, política de privacidade e procedimento de resposta a incidentes (LGPD).

## Configuração obrigatória no Supabase (produção)

- Authentication > Providers: Google habilitado; e-mail com confirmação obrigatória.
- Authentication > Multi-Factor: App Authenticator (TOTP) habilitado.
- Authentication > Passwords: mínimo 12 caracteres; ativar proteção contra senhas vazadas quando o plano permitir.
- Authentication > URL Configuration: Site URL do domínio de produção e `https://SEU-DOMINIO/auth/callback` nas URLs de redirecionamento.
- Plano pago antes de dados reais: backups diários e sem pausa por inatividade.
