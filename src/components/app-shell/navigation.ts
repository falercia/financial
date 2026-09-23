/**
 * Estrutura do menu lateral. Itens sem `href` ainda não foram construídos e
 * aparecem como "em breve", para a navegação refletir o roadmap sem links quebrados.
 */
export type NavItem = { label: string; href?: string };
export type NavGroup = { id: string; label: string; icon: string; items: NavItem[] };

export const OVERVIEW: NavItem = { label: "Visão geral", href: "/" };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "gastos",
    label: "Gastos",
    icon: "M3 6h18v12H3zM3 10h18M7 15h3",
    items: [
      { label: "Despesas" },
      { label: "Cartões e faturas" },
      { label: "Parcelamentos" },
      { label: "Contas recorrentes" },
      { label: "Fornecedores" },
      { label: "Categorias" },
    ],
  },
  {
    id: "planejamento",
    label: "Planejamento",
    icon: "M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z",
    items: [{ label: "Orçamento" }, { label: "Receitas e renda" }, { label: "Calendário" }, { label: "Projeções" }],
  },
  {
    id: "assistente",
    label: "Assistente",
    icon: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
    items: [{ label: "Chat com IA" }, { label: "Insights e dicas" }],
  },
  {
    id: "dados",
    label: "Dados",
    icon: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
    items: [
      { label: "Importações" },
      { label: "WhatsApp" },
      { label: "Regras de classificação" },
      { label: "Backup e exportação" },
    ],
  },
  {
    id: "configuracoes",
    label: "Configurações",
    icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
    items: [{ label: "Organização e membros", href: "/organizacao" }, { label: "Conexões de IA" }],
  },
];
