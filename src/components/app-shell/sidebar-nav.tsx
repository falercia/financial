"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_GROUPS, OVERVIEW, type NavGroup } from "./navigation";

function isActive(pathname: string, href?: string) {
  if (!href) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function Icon({ d }: { d: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function Group({ group, pathname }: { group: NavGroup; pathname: string }) {
  const containsActive = group.items.some((item) => isActive(pathname, item.href));
  const [open, setOpen] = useState(containsActive);
  const panelId = `nav-${group.id}`;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="text-night-ink hover:bg-night-raised/60 flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm"
      >
        <Icon d={group.icon} />
        <span className="flex-1">{group.label}</span>
        {containsActive && !open ? <span aria-hidden="true" className="size-1.5 rounded-full bg-[#9fb0d9]" /> : null}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8e9198"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className={open ? "rotate-180" : ""}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <ul id={panelId} className="flex flex-col gap-px pt-0.5 pb-2 pl-[29px]">
          {group.items.map((item) => (
            <li key={item.label}>
              {item.href ? (
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={`flex min-h-9 items-center rounded-lg px-3 text-[13.5px] ${
                    isActive(pathname, item.href)
                      ? "bg-night-raised font-semibold text-white"
                      : "hover:bg-night-raised/60 text-[#aeb1b7]"
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <span className="flex min-h-9 items-center justify-between rounded-lg px-3 text-[13.5px] text-[#7c8088]">
                  {item.label}
                  <span className="text-[10px] font-semibold tracking-wide">EM BREVE</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const overviewActive = isActive(pathname, OVERVIEW.href);

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
      <Link
        href={OVERVIEW.href ?? "/"}
        aria-current={overviewActive ? "page" : undefined}
        className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm ${
          overviewActive ? "bg-night-raised font-semibold text-white" : "text-night-ink hover:bg-night-raised/60"
        }`}
      >
        <Icon d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
        {OVERVIEW.label}
      </Link>
      {NAV_GROUPS.map((group) => (
        <Group key={group.id} group={group} pathname={pathname} />
      ))}
      <div aria-disabled="true" className="flex min-h-10 items-center gap-3 px-3 text-sm text-[#7c8088]">
        <Icon d="M3 17l6-6 4 4 8-8M15 7h6v6" />
        <span className="flex-1">Investimentos</span>
        <span className="text-night-ink rounded-full border border-[#3a3e46] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">
          EM BREVE
        </span>
      </div>
    </nav>
  );
}
