import { fmtC, type Unit } from "@/lib/temperature";

type Point = { t: string; v: number; ok: boolean };

/** Gráfica de una cámara: banda del rango permitido, línea de lecturas y puntos fuera de rango en rojo. */
export function TempChart({ unit, points, start, end, tz }: { unit: Unit; points: Point[]; start: Date; end: Date; tz: string }) {
  const W = 640, H = 180, L = 44, R = 12, T = 12, B = 26;
  const vals = points.map((p) => p.v);
  const lowRef = unit.kind === "congelacion" && unit.min_c <= -40 ? unit.max_c - 8 : unit.min_c;
  let lo = Math.floor(Math.min(lowRef, ...vals) - 1);
  let hi = Math.ceil(Math.max(unit.max_c, ...vals) + 1);
  if (hi - lo < 4) { lo -= 2; hi += 2; }
  const t0 = start.getTime(), t1 = end.getTime();
  const x = (t: number) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const step = Math.max(1, Math.ceil((hi - lo) / 4));
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const days: Date[] = [];
  for (let t = t0; t < t1; t += 86_400_000) days.push(new Date(t));
  const showEvery = Math.ceil(days.length / 7);
  const bandTop = y(Math.min(unit.max_c, hi));
  const bandBottom = y(Math.max(unit.min_c, lo));
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(Date.parse(p.t)).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const dayFmt = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", timeZone: tz });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label={`Gráfica de ${unit.code}: ${points.length} lecturas`}>
      <rect x={L} y={bandTop} width={W - L - R} height={Math.max(0, bandBottom - bandTop)} className="fill-ok-soft" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" className="fill-muted font-mono text-[11px]">{fmtC(v, 0)}</text>
        </g>
      ))}
      {days.map((d, i) => i % showEvery === 0 && (
        <text key={i} x={x(d.getTime()) + 2} y={H - 8} className="fill-muted text-[11px]">{dayFmt.format(d)}</text>
      ))}
      {points.length > 1 && <path d={line} fill="none" className="stroke-accent" strokeWidth={2} />}
      {points.map((p, i) => (
        <circle key={i} cx={x(Date.parse(p.t))} cy={y(p.v)} r={p.ok ? 3 : 5} className={p.ok ? "fill-accent" : "fill-crit"} />
      ))}
    </svg>
  );
}
