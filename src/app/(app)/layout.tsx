import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { OrgSwitcher } from "@/components/app-shell/org-switcher";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { signOut } from "@/modules/identity/application/auth-actions";
import {
  getActiveOrganization,
  listMyOrganizations,
  type OrganizationSummary,
} from "@/modules/identity/application/organizations";
import { requireMfaSession } from "@/modules/identity/application/session";
import { ROLE_LABEL } from "@/modules/identity/domain/roles";

function SidebarContent({
  email,
  organizations,
  active,
}: {
  email: string | null;
  organizations: OrganizationSummary[];
  active: OrganizationSummary;
}) {
  return (
    <>
      <OrgSwitcher organizations={organizations.map(({ id, name }) => ({ id, name }))} activeId={active.id} />
      <SidebarNav />
      <div className="mt-auto flex flex-col gap-1.5 px-2.5 pt-4">
        <span className="truncate text-[13px] font-medium text-white">{email}</span>
        <span className="text-[11px] text-[#9a9da3]">{ROLE_LABEL[active.role]} · MFA ativo</span>
        <form action={signOut}>
          <button type="submit" className="min-h-9 text-[13px] text-[#9fb0d9] hover:text-white">
            Sair
          </button>
        </form>
      </div>
    </>
  );
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireMfaSession();
  const [organizations, active] = await Promise.all([listMyOrganizations(), getActiveOrganization()]);
  if (!active) redirect("/boas-vindas");

  const brand = (
    <div className="flex items-center gap-2.5 px-2.5">
      <BrandMark />
      <span className="font-serif text-[19px] font-medium text-white">Finanças</span>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <details className="group bg-night lg:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-3">
          {brand}
          <span className="text-night-ink px-2 text-sm">Menu</span>
        </summary>
        <div className="flex flex-col gap-4 px-3 pb-5">
          <SidebarContent email={session.email} organizations={organizations} active={active} />
        </div>
      </details>
      <aside className="bg-night sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-4 overflow-y-auto px-3 py-5 lg:flex">
        {brand}
        <SidebarContent email={session.email} organizations={organizations} active={active} />
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-10 sm:py-8">{children}</main>
    </div>
  );
}
