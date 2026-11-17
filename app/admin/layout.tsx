import { requireSession } from "@/lib/session";
import { Sidebar, type NavItem } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(["admin", "manager"]);
  const items: NavItem[] = [
    { href: "/restaurantes", label: "Ir a un local", icon: "home" },
    { href: "/admin/restaurantes", label: "Restaurantes", icon: "building" },
  ];
  if (session.kind === "admin") items.push({ href: "/admin/encargados", label: "Encargados", icon: "users" });
  items.push({ href: "/admin/actividad", label: "Actividad", icon: "history" });
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <Sidebar items={items} />
      <main className="grid flex-1 content-start gap-6 p-4 md:p-6">
        <TopBar session={session} />
        {children}
      </main>
    </div>
  );
}
