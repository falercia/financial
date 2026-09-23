"use client";

import Link from "next/link";
import { switchOrganization } from "@/modules/identity/application/organization-actions";

type Org = { id: string; name: string };

export function OrgSwitcher({ organizations, activeId }: { organizations: Org[]; activeId: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-[#2e323a] bg-[#1c1f24] p-2.5">
      <form action={switchOrganization}>
        <label htmlFor="org-switcher" className="block px-1 text-[11px] text-[#9a9da3]">
          Organização ativa
        </label>
        <select
          id="org-switcher"
          name="orgId"
          defaultValue={activeId}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="mt-1 min-h-9 w-full cursor-pointer rounded-md bg-transparent px-1 text-[13.5px] font-semibold text-white"
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id} className="text-ink">
              {org.name}
            </option>
          ))}
        </select>
        <noscript>
          <button type="submit" className="mt-1 text-xs text-white underline">
            Trocar
          </button>
        </noscript>
      </form>
      <Link href="/boas-vindas?nova=1" className="px-1 text-[12px] text-[#9fb0d9] hover:text-white">
        + Nova organização
      </Link>
    </div>
  );
}
