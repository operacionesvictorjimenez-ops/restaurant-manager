"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Thermometer, Tag, BookOpen, PlayCircle, Settings, Building2, Users, History, TriangleAlert, type LucideIcon,
} from "lucide-react";
import { cx } from "@/components/ui";

const ICONS: Record<string, LucideIcon> = {
  home: Home, thermo: Thermometer, tag: Tag, book: BookOpen, play: PlayCircle, settings: Settings,
  building: Building2, users: Users, history: History, alert: TriangleAlert,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean; soon?: boolean };

export function Sidebar({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="flex gap-1 overflow-x-auto bg-side print:hidden p-2 text-side-ink md:min-h-full md:w-28 md:flex-col md:overflow-visible md:p-3"
    >
      <Link href="/" className="mx-auto mb-3 hidden size-12 place-items-center rounded-xl bg-accent font-display text-xl font-extrabold text-white md:grid">
        RM
      </Link>
      {items.map((it) => {
        const Icon = ICONS[it.icon];
        const active = it.exact ? path === it.href : path === it.href || path.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "grid min-w-20 justify-items-center gap-1 rounded-xl px-1 py-2.5 text-center text-xs font-semibold leading-tight md:min-w-0",
              active ? "bg-white/15 text-white" : "hover:bg-white/5",
              it.soon && "opacity-50",
            )}
          >
            <Icon className="size-7" strokeWidth={1.8} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
