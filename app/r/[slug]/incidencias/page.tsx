import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { Card, Pill, inputClass } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { getRestaurant } from "../data";
import { closeIncident } from "./actions";

export const metadata = { title: "Incidencias · Restaurant Manager" };

export default async function Incidents({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ver?: string }>;
}) {
  const { slug } = await params;
  const { ver } = await searchParams;
  const showClosed = ver === "cerradas";
  const r = await getRestaurant(slug);
  const session = await getSession();
  const canClose = session?.kind === "admin" || session?.kind === "manager";
  const supabase = await createClient();
  const { data: list } = await supabase
    .from("incidents")
    .select("id, title, corrective_action, status, opened_at, resolution, closed_at, module")
    .eq("restaurant_id", r.id)
    .eq("status", showClosed ? "cerrada" : "abierta")
    .order("opened_at", { ascending: false })
    .limit(100);
  const base = `/r/${r.slug}/incidencias`;

  return (
    <>
      <h1 className="font-display text-4xl font-bold leading-none">Incidencias</h1>
      <div className="flex gap-2">
        <Link href={base} className={`rounded-xl border px-4 py-2.5 font-bold ${!showClosed ? "border-ink bg-ink text-bg" : "border-line bg-surface"}`}>Abiertas</Link>
        <Link href={`${base}?ver=cerradas`} className={`rounded-xl border px-4 py-2.5 font-bold ${showClosed ? "border-ink bg-ink text-bg" : "border-line bg-surface"}`}>Cerradas</Link>
      </div>
      {!canClose && !showClosed && (list?.length ?? 0) > 0 && (
        <p className="text-muted">El encargado revisará y cerrará estas incidencias.</p>
      )}
      <div className="grid gap-3">
        {list?.map((i) => (
          <Card key={i.id} className="grid gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="grid gap-1">
                <span className="text-lg font-bold">{i.title}</span>
                <span className="text-sm text-muted">Abierta el {formatDateTime(i.opened_at, r.timezone)} · {i.module}</span>
              </div>
              {i.status === "abierta" ? <Pill tone="crit">Abierta</Pill> : <Pill tone="ok">Cerrada</Pill>}
            </div>
            {i.corrective_action && <p><b>Acción correctora:</b> {i.corrective_action}</p>}
            {i.status === "cerrada" && (
              <p><b>Resolución:</b> {i.resolution} <span className="text-muted">({formatDateTime(i.closed_at!, r.timezone)})</span></p>
            )}
            {i.status === "abierta" && canClose && (
              <ActionForm action={closeIncident} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                <input type="hidden" name="id" value={i.id} />
                <input id={`res-${i.id}`} name="resolution" required minLength={3} maxLength={300}
                  placeholder="Cómo se ha resuelto (p. ej. temperatura recuperada a 3,1 °C)" className={inputClass} />
                <SubmitButton pendingText="Cerrando…">Cerrar incidencia</SubmitButton>
              </ActionForm>
            )}
          </Card>
        ))}
        {!list?.length && (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-muted">
            {showClosed ? "No hay incidencias cerradas." : "No hay incidencias abiertas."}
          </p>
        )}
      </div>
    </>
  );
}
