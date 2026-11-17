/**
 * Lógica pura del control de temperaturas: horarios en la zona del restaurante
 * y estado de cada cámara. Sin dependencias, para poder probarla.
 */

export type StorageKind = "refrigeracion" | "congelacion";

export type Unit = {
  id: string;
  code: string;
  name: string;
  kind: StorageKind;
  min_c: number;
  max_c: number;
};

export type LastReading = { value_c: number; recorded_at: string; in_range: boolean } | null;

export type UnitStatus = "ok" | "pendiente" | "atrasado" | "fuera" | "remedir";

export const KIND_LABEL: Record<StorageKind, string> = {
  refrigeracion: "Refrigeración",
  congelacion: "Congelación",
};

export const DEFAULT_RANGE: Record<StorageKind, { min: number; max: number }> = {
  refrigeracion: { min: 0, max: 4 },
  congelacion: { min: -40, max: -18 },
};

/** Minutos tras una lectura fuera de rango para volver a medir. */
export const REMEASURE_MINUTES = 30;

export const CORRECTIVE_ACTIONS = [
  "Puerta mal cerrada: cerrada y revisada",
  "Cámara sobrecargada: reorganizada",
  "Desescarche en curso",
  "Producto trasladado a otra cámara",
  "Avisado el técnico de frío",
  "Producto desechado",
];

// ------------------------------------------------------------------ zonas horarias

function tzOffsetMs(instant: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Fecha local "YYYY-MM-DD" en la zona indicada. */
export function localDate(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Instante UTC correspondiente a una fecha y hora locales ("2026-11-18", "09:00"). */
export function zonedInstant(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - tzOffsetMs(guess, tz);
  t = guess - tzOffsetMs(t, tz); // corrige en los cambios de hora
  return new Date(t);
}

export function formatTime(value: string | Date, tz: string) {
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(value));
}

/** "09:00:00" → "09:00" */
export const hhmm = (t: string) => t.slice(0, 5);

// ------------------------------------------------------------------ controles del día

export type Slot = { label: string; start: Date; deadline: Date };

export function todaySlots(times: string[], tolerance: number, tz: string, now = new Date()): Slot[] {
  const day = localDate(tz, now);
  return [...times]
    .map(hhmm)
    .sort()
    .map((label) => {
      const start = zonedInstant(day, label, tz);
      return { label, start, deadline: new Date(start.getTime() + tolerance * 60_000) };
    });
}

/** Control en curso: el último cuya hora ya ha llegado hoy. */
export function currentSlot(slots: Slot[], now = new Date()): Slot | null {
  const past = slots.filter((s) => s.start.getTime() <= now.getTime());
  return past.length ? past[past.length - 1] : null;
}

export function nextSlot(slots: Slot[], now = new Date()): Slot | null {
  return slots.find((s) => s.start.getTime() > now.getTime()) ?? null;
}

// ------------------------------------------------------------------ estado de una cámara

export function unitStatus(
  last: LastReading,
  slot: Slot | null,
  openIncidentAt: string | null,
  now = new Date(),
): UnitStatus {
  if (last && !last.in_range) return "fuera";
  if (openIncidentAt) {
    const since = new Date(openIncidentAt).getTime();
    const measuredAfter = last && new Date(last.recorded_at).getTime() > since;
    if (!measuredAfter) return "remedir";
  }
  if (slot) {
    const done = last && new Date(last.recorded_at).getTime() >= slot.start.getTime();
    if (!done) return now.getTime() > slot.deadline.getTime() ? "atrasado" : "pendiente";
  }
  return "ok";
}

export const STATUS_META: Record<UnitStatus, { label: string; tone: "ok" | "warn" | "crit" }> = {
  ok: { label: "Correcta", tone: "ok" },
  pendiente: { label: "Pendiente", tone: "warn" },
  atrasado: { label: "Control atrasado", tone: "crit" },
  fuera: { label: "Fuera de rango", tone: "crit" },
  remedir: { label: "Volver a medir", tone: "warn" },
};

export function inRange(value: number, u: Pick<Unit, "min_c" | "max_c">) {
  return value >= u.min_c && value <= u.max_c;
}

export function formatRange(u: Pick<Unit, "min_c" | "max_c" | "kind">) {
  if (u.kind === "congelacion" && u.min_c <= -40) return `≤ ${fmtC(u.max_c)} °C`;
  return `${fmtC(u.min_c)} a ${fmtC(u.max_c)} °C`;
}

/** 3.5 → "3,5"; -18 → "−18,0" */
export function fmtC(v: number, decimals = 1) {
  return v.toFixed(decimals).replace(".", ",").replace("-", "−");
}

/** Convierte lo tecleado ("−3,5", "-3.5") en número o null. */
export function parseTemp(input: string): number | null {
  const s = input.trim().replace("−", "-").replace(",", ".");
  if (!/^-?\d{1,2}(\.\d)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "09:12" si es de hoy; "17/11 09:12" si es de otro día. */
export function formatWhen(value: string, tz: string, now = new Date()) {
  const d = new Date(value);
  const time = formatTime(d, tz);
  if (localDate(tz, d) === localDate(tz, now)) return time;
  const day = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", timeZone: tz }).format(d);
  return `${day} ${time}`;
}
