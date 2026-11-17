import Link from "next/link";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { getHistory, parsePeriod } from "@/lib/temperature-data";
import { fmtC, formatRange, formatWhen } from "@/lib/temperature";
import { TempChart } from "@/components/temp-chart";
import { PeriodFilter } from "@/components/period-filter";
import { Pill } from "@/components/ui";
import { getRestaurant } from "../../data";

export const metadata = { title: "Histórico de temperaturas · Restaurant Manager" };

export default async function TemperatureHistory({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string; camara?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const r = await getRestaurant(slug);
  const period = parsePeriod(r.timezone, sp.desde, sp.hasta);
  const unitId = sp.camara && /^[0-9a-f-]{36}$/.test(sp.camara) ? sp.camara : undefined;
  const { rows, units } = await getHistory(r.id, period, unitId);
  const shown = units.filter((u) => !unitId || u.id === unitId);
  const qs = new URLSearchParams({ desde: period.from, hasta: period.to, ...(unitId ? { camara: unitId } : {}) }).toString();
  const base = `/r/${r.slug}/temperaturas`;
  const byUnit = new Map(units.map((u) => [u.id, u]));

  return (
    <>
      <Link href={base} className="flex items-center gap-2 text-sm font-semibold text-muted"><ArrowLeft className="size-4" />Temperaturas</Link>
      <h1 className="font-display text-4xl font-bold leading-none">Histórico</h1>
      <PeriodFilter from={period.from} to={period.to} units={units} unitId={unitId}
        extra={<>
          <a href={`${base}/exportar?${qs}`} className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-bold"><Download className="size-5" />Excel (CSV)</a>
          <Link href={`${base}/informe?${qs}`} className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-bold"><FileText className="size-5" />Informe PDF</Link>
        </>} />

      <div className="grid gap-4 xl:grid-cols-2">
        {shown.map((u) => {
          const pts = rows.filter((x) => x.unit_id === u.id);
          const out = pts.filter((p) => !p.in_range).length;
          return (
            <div key={u.id} className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{u.code} · {u.name}</span>
                <span className="flex gap-2">
                  <Pill tone="muted">{formatRange(u)}</Pill>
                  <Pill tone="muted">{pts.length} lecturas</Pill>
                  {out > 0 && <Pill tone="crit">{out} fuera</Pill>}
                </span>
              </div>
              {pts.length ? (
                <TempChart unit={u} start={period.start} end={period.end} tz={r.timezone}
                  points={pts.map((p) => ({ t: p.recorded_at, v: p.value_c, ok: p.in_range }))} />
              ) : (
                <p className="py-8 text-center text-muted">Sin lecturas en este periodo.</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted">
            <tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Cámara</th><th className="px-4 py-3">Temperatura</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Acción correctora / notas</th></tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((x) => (
              <tr key={x.id} className="border-t border-line">
                <td className="px-4 py-2.5 font-mono tnum">{formatWhen(x.recorded_at, r.timezone, new Date(0))}</td>
                <td className="px-4 py-2.5 font-semibold">{byUnit.get(x.unit_id)?.code}</td>
                <td className="px-4 py-2.5 font-mono font-bold tnum">{fmtC(x.value_c)} °C</td>
                <td className="px-4 py-2.5">{x.in_range ? <Pill tone="ok">Correcta</Pill> : <Pill tone="crit">Fuera de rango</Pill>}</td>
                <td className="px-4 py-2.5">{[x.action, x.note].filter(Boolean).join(" · ") || "—"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No hay lecturas en este periodo.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
