import { inputClass } from "@/components/ui";

export function PeriodFilter({
  from, to, units, unitId, extra,
}: {
  from: string; to: string; units?: { id: string; code: string; name: string }[]; unitId?: string; extra?: React.ReactNode;
}) {
  return (
    <form className="flex flex-wrap items-end gap-3 print:hidden">
      <label className="grid gap-1 text-sm font-semibold">Desde
        <input id="desde" type="date" name="desde" defaultValue={from} className={`${inputClass} min-h-11`} />
      </label>
      <label className="grid gap-1 text-sm font-semibold">Hasta
        <input id="hasta" type="date" name="hasta" defaultValue={to} className={`${inputClass} min-h-11`} />
      </label>
      {units && (
        <label className="grid gap-1 text-sm font-semibold">Cámara
          <select id="camara" name="camara" defaultValue={unitId ?? ""} className={`${inputClass} min-h-11`}>
            <option value="">Todas</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.code} · {u.name}</option>)}
          </select>
        </label>
      )}
      <button className="min-h-11 rounded-xl bg-ink px-5 font-bold text-bg">Ver</button>
      {extra}
    </form>
  );
}
