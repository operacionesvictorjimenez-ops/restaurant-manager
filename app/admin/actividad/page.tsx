import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "Actividad · Administración" };

const LABELS: Record<string, string> = {
  "restaurants:insert": "Restaurante creado",
  "restaurants:update": "Restaurante modificado",
  "profiles:insert": "Cuenta creada",
  "profiles:update": "Cuenta modificada",
  "manager_restaurants:insert": "Restaurante asignado a encargado",
  "manager_restaurants:delete": "Restaurante retirado a encargado",
  "restaurant_pins:pin_changed": "PIN del local cambiado",
  "restaurant_pins:pin_locked": "Tablet bloqueada por intentos fallidos",
};

export default async function Activity() {
  await requireSession(["admin", "manager"]);
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("audit_log")
    .select("id, at, actor_id, restaurant_id, table_name, action")
    .order("at", { ascending: false })
    .limit(200);
  const [{ data: people }, { data: restaurants }] = await Promise.all([
    supabase.from("profiles").select("id, full_name"),
    supabase.from("restaurants").select("id, code"),
  ]);
  const name = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const code = new Map((restaurants ?? []).map((r) => [r.id, r.code]));

  return (
    <>
      <PageTitle sub="Últimos 200 cambios. Este registro no se puede modificar.">Histórico de actividad</PageTitle>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted">
            <tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Acción</th><th className="px-4 py-3">Local</th><th className="px-4 py-3">Quién</th></tr>
          </thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-3 font-mono tnum">{formatDateTime(r.at)}</td>
                <td className="px-4 py-3">{LABELS[`${r.table_name}:${r.action}`] ?? `${r.table_name} · ${r.action}`}</td>
                <td className="px-4 py-3 font-mono font-bold">{r.restaurant_id ? code.get(r.restaurant_id) ?? "—" : "—"}</td>
                <td className="px-4 py-3">{r.actor_id ? name.get(r.actor_id) ?? "Sistema" : "Sistema"}</td>
              </tr>
            ))}
            {!rows?.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">Sin actividad todavía.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
