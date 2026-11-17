type R = { id: string; code: string; name: string };

/** Lista de casillas para asignar restaurantes, con 34+ locales en columnas. */
export function RestaurantChecklist({ restaurants, selected }: { restaurants: R[]; selected?: Set<string> }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-semibold">Restaurantes autorizados</legend>
      <div className="grid max-h-80 gap-2 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-2">
        {restaurants.map((r) => (
          <label key={r.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
            <input id={`r-${r.id}`} type="checkbox" name="restaurants" value={r.id} defaultChecked={selected?.has(r.id)} className="size-5 accent-accent" />
            <span><span className="font-mono text-xs font-bold text-muted">{r.code}</span> {r.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
