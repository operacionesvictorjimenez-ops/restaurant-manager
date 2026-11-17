import { requireSession } from "@/lib/session";
import { Sidebar, type NavItem } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { IdleLock } from "@/components/idle-lock";
import { getRestaurant } from "./data";

export default async function RestaurantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireSession();
  const r = await getRestaurant(slug);
  const base = `/r/${r.slug}`;
  const items: NavItem[] = [
    { href: base, label: "Inicio", icon: "home", exact: true },
    { href: `${base}/temperaturas`, label: "Temperaturas", icon: "thermo", soon: true },
    { href: `${base}/etiquetas`, label: "Etiquetas", icon: "tag", soon: true },
    { href: `${base}/recetas`, label: "Recetas", icon: "book", soon: true },
    { href: `${base}/formacion`, label: "Formación", icon: "play", soon: true },
  ];
  if (session.kind !== "kiosk") items.push({ href: "/admin", label: "Admin", icon: "settings" });
  const idleMinutes = Number((r.settings as { idle_lock_minutes?: number })?.idle_lock_minutes ?? 5);

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <Sidebar items={items} />
      <main className="grid flex-1 content-start gap-5 p-4 md:p-6">
        <TopBar session={session} restaurantName={r.name} />
        {children}
      </main>
      {session.kind === "kiosk" && <IdleLock minutes={idleMinutes} />}
    </div>
  );
}
