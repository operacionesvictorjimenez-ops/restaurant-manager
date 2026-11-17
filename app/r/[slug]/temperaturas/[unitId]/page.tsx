import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Snowflake, Refrigerator } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTemperatureBoard } from "@/lib/temperature-data";
import { fmtC, formatRange, formatWhen, KIND_LABEL } from "@/lib/temperature";
import { SavedBanner } from "@/components/saved-banner";
import { cx, Pill } from "@/components/ui";
import { getRestaurant } from "../../data";
import { RecordForm } from "./record-form";

export default async function RecordUnit({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; unitId: string }>;
  searchParams: Promise<{ guardado?: string }>;
}) {
  const { slug, unitId } = await params;
  const { guardado } = await searchParams;
  const r = await getRestaurant(slug);
  if (!/^[0-9a-f-]{36}$/.test(unitId)) notFound();
  const board = await getTemperatureBoard(r.id, r.timezone);
  const idx = board.units.findIndex((u) => u.id === unitId);
  if (idx < 0) notFound();
  const unit = board.units[idx];
  const base = `/r/${r.slug}/temperaturas`;

  // Siguiente cámara que aún no se ha medido en este control, para encadenar la ronda.
  const after = [...board.units.slice(idx + 1), ...board.units.slice(0, idx)];
  const nextPending = after.find((u) => u.status === "pendiente" || u.status === "atrasado" || u.status === "remedir");
  const nextHref = unit.status === "ok" ? null : nextPending ? `${base}/${nextPending.id}` : null;

  const supabase = await createClient();
  const { data: recent } = await supabase
    .from("temperature_readings")
    .select("id, value_c, recorded_at, in_range")
    .eq("storage_unit_id", unit.id)
    .order("recorded_at", { ascending: false })
    .limit(6);

  const Icon = unit.kind === "congelacion" ? Snowflake : Refrigerator;
  return (
    <>
      <Link href={base} className="flex items-center gap-2 text-sm font-semibold text-muted"><ArrowLeft className="size-4" />Todas las cámaras</Link>
      <SavedBanner text={guardado} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="grid content-start gap-4">
          <div className="flex items-center gap-3">
            <span className={cx("grid size-14 place-items-center rounded-xl", unit.kind === "congelacion" ? "bg-frz-soft text-frz" : "bg-accent-soft text-accent")}>
              <Icon className="size-8" />
            </span>
            <div>
              <h1 className="font-display text-3xl font-bold leading-none">{unit.code} · {unit.name}</h1>
              <p className="text-muted">{KIND_LABEL[unit.kind]} · {formatRange(unit)}</p>
            </div>
          </div>
          <RecordForm unit={unit} doneHref={base} nextHref={nextHref} />
        </div>
        <div className="grid content-start gap-3">
          <h2 className="font-bold">Últimas lecturas</h2>
          {recent?.length ? (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {recent.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-muted tnum">{formatWhen(x.recorded_at, r.timezone)}</span>
                  <span className="font-mono text-lg font-bold tnum">{fmtC(Number(x.value_c))} °C</span>
                  {x.in_range ? <Pill tone="ok">Correcta</Pill> : <Pill tone="crit">Fuera</Pill>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Todavía no hay lecturas de esta cámara.</p>
          )}
        </div>
      </div>
    </>
  );
}
