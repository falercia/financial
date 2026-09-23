import { BrandMark } from "@/components/brand-mark";

export default function OnboardingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="flex items-center gap-2.5">
        <BrandMark tone="dark" size={32} />
        <span className="font-serif text-xl">Finanças</span>
      </div>
      <main className="border-line bg-surface w-full max-w-[440px] rounded-[16px] border p-7">{children}</main>
    </div>
  );
}
