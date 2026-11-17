const TZ = "Europe/Madrid";

export function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("es-ES", { hour: "numeric", hour12: false, timeZone: TZ }).format(now));
  if (h >= 6 && h < 14) return "Buenos días";
  if (h >= 14 && h < 21) return "Buenas tardes";
  return "Buenas noches";
}

export function formatDateTime(value: string | Date, tz = TZ) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: tz,
  }).format(new Date(value));
}

export function formatToday(tz = TZ, now = new Date()) {
  const s = new Intl.DateTimeFormat("es-ES", {
    weekday: "long", day: "numeric", month: "long", timeZone: tz,
  }).format(now);
  return s.charAt(0).toUpperCase() + s.slice(1); // "Martes, 17 de noviembre"
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
