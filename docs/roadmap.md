# Roadmap

| Fase              | Entrega                                                                                                                                            | Estado                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 0 · Fundação      | Next.js + Supabase, login Google e e-mail, MFA obrigatório, organizações, membros, convites, RLS, auditoria, CI                                    | Concluída no código; falta configurar o projeto Supabase e a Vercel |
| 1a · Despesas     | Registro em segundos (fornecedor, valor, forma), lista e total do mês por competência, categorias padrão, despesa privada, histórico de alterações | Concluída                                                           |
| 1b a 1d           | Cartões e faturas (pagar a fatura não é gasto novo), recorrentes com ocorrências, parcelamentos, receitas                                          | Próxima                                                             |
| 2 · Análise       | Visão geral, filtros com referência temporal, orçamento por categoria e tipo, renda × gastos, compromissos futuros                                 |                                                                     |
| 3 · Captura fácil | WhatsApp (texto, foto, áudio), importação de CSV e PDF, OCR, revisão, conciliação com o total, deduplicação, regras                                |                                                                     |
| 4 · IA            | Conexões por organização (BYOK), chat com ferramentas somente leitura, insights e dicas                                                            |                                                                     |
| 5 · Robustez      | Backup e restauração testados, exportação completa, rate limiting, CSP com nonce, observabilidade, testes E2E                                      |                                                                     |
| Futuro            | Investimentos; cobrança por plano (quantidade de pessoas)                                                                                          |                                                                     |

## WhatsApp (Fase 3): desenho proposto

Objetivo: registrar uma despesa em menos de 10 segundos, sem abrir o app.

**Vínculo do número**

1. Na tela "WhatsApp", a pessoa informa o celular.
2. O app mostra um código de 6 dígitos válido por 10 minutos.
3. A pessoa manda o código para o número oficial do app. O vínculo liga número, pessoa e organização.
4. Um número pertence a uma pessoa. Quem participa de várias organizações escolhe a organização padrão ou prefixa a mensagem.

**Uso**

- Texto livre: "mercado 187,90 nubank" vira uma despesa com fornecedor, valor e forma de pagamento.
- Foto de cupom ou boleto: leitura do documento, com os campos extraídos.
- Áudio: transcrição e o mesmo fluxo do texto.
- O app responde com o resumo e botões "Confirmar", "Corrigir" e "Descartar". Nada entra como fato sem confirmação quando houver dúvida.
- O lançamento guarda a mensagem de origem, para rastreabilidade.

**Segurança**

- Webhook com verificação da assinatura da Meta; mensagens de números não vinculados são ignoradas.
- Pelo WhatsApp só é possível **criar** lançamentos em rascunho e consultar resumos simples da própria pessoa. Nada de administração, convites ou exportação.
- Desvincular o número a qualquer momento; vínculo expira se o número mudar de dono (confirmação periódica).

**Custos e dependências**

- WhatsApp Business Platform (Cloud API) da Meta, com número próprio e verificação do negócio.
- Texto livre, foto e áudio usam a conexão de IA da organização (BYOK). Sem conexão de IA, o WhatsApp aceita só o formato estruturado "fornecedor valor forma".
