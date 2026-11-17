import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_RANGE } from "@/lib/temperature";

/** Cámaras por defecto de un restaurante nuevo. */
export const DEFAULT_UNIT_COUNTS = { refrigeracion: 7, congelacion: 4 };

/**
 * Crea las cámaras estándar CR-1…CR-n (refrigeración) y CF-1…CF-n (congelación)
 * con los rangos por defecto, saltando los códigos que ya existan.
 */
export async function createStandardUnits(
  supabase: SupabaseClient,
  restaurantId: string,
  counts: { refrigeracion: number; congelacion: number },
) {
  const { data: existing } = await supabase.from("storage_units").select("code").eq("restaurant_id", restaurantId);
  const taken = new Set((existing ?? []).map((u) => u.code));
  const rows: Record<string, unknown>[] = [];
  let order = (existing?.length ?? 0) * 10;
  for (const [kind, prefix, label] of [
    ["refrigeracion", "CR", "Cámara de refrigeración"],
    ["congelacion", "CF", "Cámara de congelación"],
  ] as const) {
    for (let i = 1; i <= counts[kind]; i++) {
      const code = `${prefix}-${i}`;
      if (taken.has(code)) continue;
      order += 10;
      rows.push({
        restaurant_id: restaurantId, code, name: `${label} ${i}`, kind,
        min_c: DEFAULT_RANGE[kind].min, max_c: DEFAULT_RANGE[kind].max, sort_order: order,
      });
    }
  }
  if (!rows.length) return { created: 0, error: null };
  const { error } = await supabase.from("storage_units").insert(rows);
  return { created: error ? 0 : rows.length, error };
}
