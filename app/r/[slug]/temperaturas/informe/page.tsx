import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getHistory, parsePeriod } from "@/lib/temperature-data";
import { fmtC, formatRange, KIND_LABEL } from "@/lib/temperature";
import { formatDateTime } from "@/lib/format";
import { PeriodFilter } from "@/components/period-filter";
import { PrintButton } from "@/components/print-button";
import { getRestaurant } from "../../data";

export const metadata = { title: "Informe de temperaturas · Restaurant Manager" };

export default async function TemperatureReport({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string; camara?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const r = await getRestaurant(slug);
  const supabase = await createClient();
  const { data: extra } = await supabase.from("restaurants").select("address").eq("id", r.id).single();
  const period = parsePeriod(r.timezone, sp.desde, sp.hasta);
  const unitId = sp.camara && /^[0-9a-f-]{36}$/.test(sp.camara) ? sp.camara : undefined;
  const { rows, units, incidents } = await getHistory(r.id, period, unitId);
  const shown = units.filter((u) => (!unitId || u.id === unitId) && (u.active || rows.some((x) => x.unit_id === u.id)));
  const byUnit = new Map(units.map((u) => [u.id, u]));
  const d = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: r.timezone });
  const t = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: r.timezone });
  const fmtDay = (s: string) => d.format(new Date(`${s}T12:00:00Z`));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/r/${r.slug}/temperaturas`} className="flex items-center gap-2 text-sm font-semibold text-muted"><ArrowLeft className="size-4" />Temperaturas</Link>
        <PrintButton />
      </div>
      <PeriodFilter from={period.from} to={period.to} units={units} unitId={unitId} />

      <article className="grid gap-6 rounded-2xl border border-line bg-white p-6 text-[#13202b] print:border-0 print:p-0">
        <header className="grid gap-1 border-b-2 border-[#13202b] pb-3">
          <p className="text-xs font-bold uppercase tracking-widest">Sistema APPCC · Registro de control de temperaturas</p>
          <h1 className="font-display text-3xl font-bold">{r.name} <span className="font-mono text-lg">({r.code})</span></h1>
          {extra?.address && <p>{extra.address}</p>}
          <p>Periodo: <b>{fmtDay(period.from)}</b> a <b>{fmtDay(period.to)}</b> · Generado el {formatDateTime(new Date(), r.timezone)}</p>
        </header>

        <section className="grid gap-2">
          <h2 className="text-lg font-bold">Resumen por cámara</h2>
          <table className="w-full border-collapse text-sm">
            <thead><tr className="border-b border-[#13202b] text-left">
              <th className="py-1.5 pr-2">Cámara</th><th className="py-1.5 pr-2">Tipo</th><th className="py-1.5 pr-2">Rango</th>
              <th className="py-1.5 pr-2 text-right">Lecturas</th><th className="py-1.5 pr-2 text-right">Fuera</th>
              <th className="py-1.5 pr-2 text-right">Mín.</th><th className="py-1.5 text-right">Máx.</th>
            </tr></thead>
            <tbody>
              {shown.map((u) => {
                const v = rows.filter((x) => x.unit_id === u.id);
                const vals = v.map((x) => x.value_c);
                return (
                  <tr key={u.id} className="border-b border-[#d6dee5]">
                    <td className="py-1.5 pr-2 font-bold">{u.code} · {u.name}</td>
                    <td className="py-1.5 pr-2">{KIND_LABEL[u.kind]}</td>
                    <td className="py-1.5 pr-2">{formatRange(u)}</td>
                    <td className="py-1.5 pr-2 text-right tnum">{v.length}</td>
                    <td className="py-1.5 pr-2 text-right font-bold tnum">{v.filter((x) => !x.in_range).length}</td>
                    <td className="py-1.5 pr-2 text-right font-mono tnum">{vals.length ? fmtC(Math.min(...vals)) : "—"}</td>
                    <td className="py-1.5 text-right font-mono tnum">{vals.length ? fmtC(Math.max(...vals)) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="grid gap-2">
          <h2 className="text-lg font-bold">Incidencias y acciones correctoras</h2>
          {incidents.length ? (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-[#13202b] text-left">
                <th className="py-1.5 pr-2">Fecha</th><th className="py-1.5 pr-2">Incidencia</th><th className="py-1.5 pr-2">Acción correctora</th><th className="py-1.5">Cierre</th>
              </tr></thead>
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id} className="border-b border-[#d6dee5] align-top">
                    <td className="py-1.5 pr-2 font-mono tnum">{formatDateTime(i.opened_at, r.timezone)}</td>
                    <td className="py-1.5 pr-2">{i.title}</td>
                    <td className="py-1.5 pr-2">{i.corrective_action}</td>
                    <td className="py-1.5">{i.status === "cerrada" ? `${formatDateTime(i.closed_at!, r.timezone)} · ${i.resolution}` : "Abierta"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p>Sin incidencias en el periodo.</p>}
        </section>

        <section className="grid gap-2">
          <h2 className="text-lg font-bold">Detalle de lecturas</h2>
          <table className="w-full border-collapse text-sm">
            <thead><tr className="border-b border-[#13202b] text-left">
              <th className="py-1 pr-2">Fecha</th><th className="py-1 pr-2">Hora</th><th className="py-1 pr-2">Cámara</th>
              <th className="py-1 pr-2 text-right">°C</th><th className="py-1">Estado</th>
            </tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} className="border-b border-[#eef2f5] break-inside-avoid">
                  <td className="py-1 pr-2 font-mono tnum">{d.format(new Date(x.recorded_at))}</td>
                  <td className="py-1 pr-2 font-mono tnum">{t.format(new Date(x.recorded_at))}</td>
                  <td className="py-1 pr-2">{byUnit.get(x.unit_id)?.code}</td>
                  <td className="py-1 pr-2 text-right font-mono font-bold tnum">{fmtC(x.value_c)}</td>
                  <td className="py-1">{x.in_range ? "Correcta" : "FUERA DE RANGO"}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5} className="py-3">Sin lecturas en el periodo.</td></tr>}
            </tbody>
          </table>
        </section>

        <footer className="grid gap-8 pt-6 sm:grid-cols-2 print:grid-cols-2">
          <p className="border-t border-[#13202b] pt-2 text-sm">Revisado por (nombre y firma)</p>
          <p className="border-t border-[#13202b] pt-2 text-sm">Fecha de revisión</p>
        </footer>
      </article>
    </>
  );
}
