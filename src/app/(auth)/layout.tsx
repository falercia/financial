import { BrandMark } from "@/components/brand-mark";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen">
      <aside className="bg-night text-night-ink hidden w-[520px] shrink-0 flex-col justify-between p-14 lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark size={34} />
          <span className="font-serif text-[22px] text-white">Finanças</span>
        </div>
        <div className="flex flex-col gap-4">
          <p className="font-serif text-[40px] leading-[1.12] text-white">Saiba para onde o dinheiro vai antes que ele vá.</p>
          <p className="text-[15px] leading-relaxed text-[#b8bbc1]">
            Faturas, contas, parcelas, orçamento e renda no mesmo lugar, com cálculos rastreáveis até o documento de origem.
          </p>
        </div>
        <ul className="flex flex-col gap-2.5 text-[13.5px]">
          <li>Verificação em duas etapas em todas as contas</li>
          <li>Cada organização isolada no banco de dados</li>
          <li>Registro de auditoria de acessos e alterações</li>
        </ul>
      </aside>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="flex w-full max-w-[420px] flex-col gap-8">
          <div className="flex items-center gap-2.5 lg:hidden">
            <BrandMark tone="dark" size={30} />
            <span className="font-serif text-xl">Finanças</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
