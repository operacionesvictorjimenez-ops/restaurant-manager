import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  currentSlot, localDate, nextSlot, todaySlots, unitStatus, zonedInstant,
  type LastReading, type Slot, type Unit, type UnitStatus,
} from "@/lib/temperature";

export type BoardUnit = Unit & { last: LastReading; status: UnitStatus; openIncidentId: string | null };
export type Board = {
  units: BoardUnit[];
  slots: Slot[];
  current: Slot | null;
  next: Slot | null;
  doneInSlot: number;
  openIncidents: number;
  times: string[];
  tolerance: number;
};

/** Estado de todas las cámaras de un restaurante para el control en curso. */
export async function getTemperatureBoard(restaurantId: string, tz: string, now = new Date()): Promise<Board> {
  const supabase = await createClient();
  const [{ data: units }, { data: last }, { data: settings }, { data: incidents }] = await Promise.all([
    supabase.from("storage_units").select("id, code, name, kind, min_c, max_c")
      .eq("restaurant_id", restaurantId).eq("active", true).order("sort_order").order("code"),
    supabase.from("v_last_readings").select("storage_unit_id, value_c, recorded_at, in_range").eq("restaurant_id", restaurantId),
    supabase.from("temperature_settings").select("check_times, tolerance_minutes").eq("restaurant_id", restaurantId).maybeSingle(),
    supabase.from("incidents").select("id, storage_unit_id, opened_at")
      .eq("restaurant_id", restaurantId).eq("status", "abierta").order("opened_at", { ascending: false }),
  ]);

  const times = (settings?.check_times as string[] | undefined) ?? ["09:00", "17:00"];
  const tolerance = settings?.tolerance_minutes ?? 60;
  const slots = todaySlots(times, tolerance, tz, now);
  const current = currentSlot(slots, now);
  const lastBy = new Map((last ?? []).map((l) => [l.storage_unit_id, l]));
  const incBy = new Map<string, { id: string; opened_at: string }>();
  (incidents ?? []).forEach((i) => i.storage_unit_id && !incBy.has(i.storage_unit_id) && incBy.set(i.storage_unit_id, i));

  const board: BoardUnit[] = (units ?? []).map((u) => {
    const l = lastBy.get(u.id);
    const lastReading: LastReading = l ? { value_c: Number(l.value_c), recorded_at: l.recorded_at, in_range: l.in_range } : null;
    const inc = incBy.get(u.id) ?? null;
    return {
      ...u,
      min_c: Number(u.min_c),
      max_c: Number(u.max_c),
      last: lastReading,
      status: unitStatus(lastReading, current, inc?.opened_at ?? null, now),
      openIncidentId: inc?.id ?? null,
    };
  });

  const doneInSlot = current
    ? board.filter((u) => u.last && new Date(u.last.recorded_at) >= current.start).length
    : 0;

  return {
    units: board, slots, current, next: nextSlot(slots, now), doneInSlot,
    openIncidents: incidents?.length ?? 0, times: times.map((t) => t.slice(0, 5)), tolerance,
  };
}

// ------------------------------------------------------------------ histórico

export type HistoryRow = {
  id: string;
  unit_id: string;
  value_c: number;
  recorded_at: string;
  in_range: boolean;
  min_c: number;
  max_c: number;
  note: string | null;
  action: string | null;
};

export type Period = { from: string; to: string; start: Date; end: Date };

/** Periodo por días locales; por defecto, los últimos 7 días. */
export function parsePeriod(tz: string, desde?: string, hasta?: string, now = new Date()): Period {
  const valid = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
  const today = localDate(tz, now);
  const to = valid(hasta) ? hasta! : today;
  const from = valid(desde) ? desde! : localDate(tz, new Date(Date.parse(to) - 6 * 86_400_000));
  const [a, b] = from <= to ? [from, to] : [to, from];
  const dayAfter = new Date(Date.parse(b) + 86_400_000).toISOString().slice(0, 10);
  return { from: a, to: b, start: zonedInstant(a, "00:00", tz), end: zonedInstant(dayAfter, "00:00", tz) };
}

export async function getHistory(restaurantId: string, period: Period, unitId?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("temperature_readings")
    .select("id, storage_unit_id, value_c, recorded_at, in_range, min_c, max_c, note")
    .eq("restaurant_id", restaurantId)
    .gte("recorded_at", period.start.toISOString())
    .lt("recorded_at", period.end.toISOString())
    .order("recorded_at", { ascending: true })
    .limit(10000);
  if (unitId) q = q.eq("storage_unit_id", unitId);
  const [{ data: readings }, { data: units }, { data: incidents }] = await Promise.all([
    q,
    supabase.from("storage_units").select("id, code, name, kind, min_c, max_c, active").eq("restaurant_id", restaurantId).order("sort_order").order("code"),
    supabase.from("incidents").select("id, reading_id, title, corrective_action, status, opened_at, resolution, closed_at, storage_unit_id")
      .eq("restaurant_id", restaurantId).eq("module", "temperaturas")
      .gte("opened_at", period.start.toISOString()).lt("opened_at", period.end.toISOString())
      .order("opened_at"),
  ]);
  const actionBy = new Map((incidents ?? []).map((i) => [i.reading_id, i.corrective_action]));
  const rows: HistoryRow[] = (readings ?? []).map((r) => ({
    id: r.id, unit_id: r.storage_unit_id, value_c: Number(r.value_c), recorded_at: r.recorded_at, in_range: r.in_range,
    min_c: Number(r.min_c), max_c: Number(r.max_c), note: r.note, action: actionBy.get(r.id) ?? null,
  }));
  const unitList: (Unit & { active: boolean })[] = (units ?? []).map((u) => ({ ...u, min_c: Number(u.min_c), max_c: Number(u.max_c) }));
  return { rows, units: unitList, incidents: incidents ?? [] };
}
