import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { PageTitle, inputClass } from "@/components/ui";

export const metadata = { title: "Restaurantes · Restaurant Manager" };

export default async function RestaurantPicker({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireSession(["admin", "manager"]);
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("restaurants").select("id, code, name, slug, address").eq("active", true).order("name");
  if (q.trim()) query = query.or(`name.ilike.%${q.trim().replace(/[%,()]/g, "")}%,code.ilike.%${q.trim().replace(/[%,()]/g, "")}%`);
  const { data: restaurants } = await query;

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <Sidebar items={[
        { href: "/restaurantes", label: "Locales", icon: "building" },
        { href: "/admin", label: "Admin", icon: "settings" },
      ]} />
      <main className="grid flex-1 content-start gap-6 p-4 md:p-6">
        <TopBar session={session} />
        <PageTitle sub={session.kind === "admin" ? "Tienes acceso a todos los restaurantes." : "Restaurantes que tienes autorizados."}>
          Elige restaurante
        </PageTitle>
        <form className="relative max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input id="q" name="q" defaultValue={q} placeholder="Buscar por nombre o código" className={`${inputClass} pl-12`} />
        </form>
        {restaurants && restaurants.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {restaurants.map((r) => (
              <Link key={r.id} href={`/r/${r.slug}`}
                className="grid gap-2 rounded-2xl border border-line bg-surface p-5 hover:border-accent">
                <div className="flex items-center justify-between gap-2">
                  <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent"><Building2 className="size-6" /></span>
                  <span className="font-mono text-xs font-bold text-muted">{r.code}</span>
                </div>
                <span className="text-lg font-bold leading-tight">{r.name}</span>
                {r.address && <span className="text-sm text-muted">{r.address}</span>}
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
            {q ? "Ningún restaurante coincide con la búsqueda." : "Todavía no tienes restaurantes autorizados. Pide acceso al administrador general."}
          </p>
        )}
      </main>
    </div>
  );
}
