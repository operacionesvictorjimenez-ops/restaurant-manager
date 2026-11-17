// Datos de prueba para desarrollo local (npm run seed). NO usar en producción.
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

loadEnv();
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!URL.includes("127.0.0.1") && !URL.includes("localhost")) {
  console.error("seed-dev solo se ejecuta contra Supabase local.");
  process.exit(1);
}
const svc = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

export const DEMO = {
  admin: { email: "admin@demo.local", password: "Admin-Demo-2026", name: "Administración General" },
  manager: { email: "encargada@demo.local", password: "Encargada-Demo-2026", name: "Marta García" },
  pin: "1234",
  restaurants: [
    { code: "CENTRO", name: "Restaurante Centro", slug: "restaurante-centro", address: "Calle Mayor 12" },
    { code: "PUERTO", name: "Restaurante Puerto", slug: "restaurante-puerto", address: "Paseo del Muelle 3" },
    { code: "PLAYA", name: "Restaurante Playa", slug: "restaurante-playa", address: "Avenida del Mar 40" },
    { code: "MOSTOLES", name: "Móstoles", slug: "mostoles", address: "Móstoles (Madrid)" },
  ],
  // Piloto: 4 de refrigeración + 3 de congelación. Centro usa las 7 + 4 por defecto.
  units: { MOSTOLES: { cr: 4, cf: 3 }, CENTRO: { cr: 7, cf: 4 } },
};

async function user(email, password, kind, name, extra = {}) {
  const { data, error } = await svc.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { kind, ...extra },
  });
  if (error) throw error;
  const { error: e2 } = await svc.from("profiles").insert({ id: data.user.id, full_name: name, kind });
  if (e2) throw e2;
  return data.user.id;
}

const { data: org } = await svc.from("organizations").select("id").limit(1).single();
await user(DEMO.admin.email, DEMO.admin.password, "admin", DEMO.admin.name);
const managerId = await user(DEMO.manager.email, DEMO.manager.password, "manager", DEMO.manager.name);

const adminClient = anon();
await adminClient.auth.signInWithPassword({ email: DEMO.admin.email, password: DEMO.admin.password });

for (const r of DEMO.restaurants) {
  const { data: row, error } = await adminClient
    .from("restaurants")
    .insert({ organization_id: org.id, code: r.code, name: r.name, slug: r.slug, address: r.address })
    .select("id").single();
  if (error) throw error;
  const kioskId = await user(`tablet-${r.code.toLowerCase()}@kiosk.restaurant-manager.app`, `Kiosk-${r.code}-dev-2026`, "kiosk", `Tablet ${r.name}`, { restaurant_id: row.id });
  await adminClient.from("restaurants").update({ kiosk_user_id: kioskId }).eq("id", row.id);
  const { error: pinErr } = await adminClient.rpc("set_restaurant_pin", { rid: row.id, pin: DEMO.pin });
  if (pinErr) throw pinErr;
  if (r.code !== "PLAYA") {
    await adminClient.from("manager_restaurants").insert({ profile_id: managerId, restaurant_id: row.id });
  }
  const counts = DEMO.units[r.code];
  if (counts) await createUnits(adminClient, row.id, counts);
  if (r.code === "MOSTOLES") await seedHistory(row.id);
}

async function createUnits(client, rid, { cr, cf }) {
  const rows = [];
  for (let i = 1; i <= cr; i++) rows.push({ restaurant_id: rid, code: `CR-${i}`, name: `Cámara de refrigeración ${i}`, kind: "refrigeracion", min_c: 0, max_c: 4, sort_order: i * 10 });
  for (let i = 1; i <= cf; i++) rows.push({ restaurant_id: rid, code: `CF-${i}`, name: `Cámara de congelación ${i}`, kind: "congelacion", min_c: -40, max_c: -18, sort_order: 100 + i * 10 });
  const { error } = await client.from("storage_units").insert(rows);
  if (error) throw error;
}

/** Hora local de Madrid → instante UTC. */
function madrid(daysAgo, hh, mm) {
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date(now.getTime() - daysAgo * 86400000));
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
  const lh = Number(parts.find((p) => p.type === "hour").value), lm = Number(parts.find((p) => p.type === "minute").value);
  const offset = ((lh * 60 + lm) - (hh * 60 + mm) + 1440) % 1440;
  return new Date(guess - (offset > 720 ? offset - 1440 : offset) * 60000);
}

/** Una semana de lecturas de ejemplo (dos controles al día) con una incidencia cerrada. */
async function seedHistory(rid) {
  const { data: units } = await svc.from("storage_units").select("id, code, kind, name, min_c, max_c").eq("restaurant_id", rid);
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const readings = [];
  for (let day = 7; day >= 1; day--) {
    for (const [hh, mm] of [[9, 5], [17, 10]]) {
      units.forEach((u, idx) => {
        const at = madrid(day, hh, mm + idx);
        let v = u.kind === "congelacion" ? -21 + rnd() * 2.5 : 1.5 + rnd() * 2;
        if (u.code === "CR-3" && day === 2 && hh === 17) v = 6.8;
        v = Math.round(v * 10) / 10;
        readings.push({ restaurant_id: rid, storage_unit_id: u.id, value_c: v, recorded_at: at.toISOString(), in_range: v >= u.min_c && v <= u.max_c, min_c: u.min_c, max_c: u.max_c });
      });
    }
  }
  // Nueva medición de CR-3 tras la acción correctora
  const cr3 = units.find((u) => u.code === "CR-3");
  readings.push({ restaurant_id: rid, storage_unit_id: cr3.id, value_c: 3.4, recorded_at: madrid(2, 17, 50).toISOString(), in_range: true, min_c: 0, max_c: 4 });
  const { data: inserted, error } = await svc.from("temperature_readings").insert(readings).select("id, value_c, storage_unit_id");
  if (error) throw error;
  const bad = inserted.find((x) => Number(x.value_c) === 6.8);
  const { error: e2 } = await svc.from("incidents").insert({
    restaurant_id: rid, module: "temperaturas", storage_unit_id: cr3.id, reading_id: bad.id,
    title: `${cr3.name} a 6,8 °C (rango 0,0 a 4,0 °C)`, corrective_action: "Puerta mal cerrada: cerrada y revisada",
    opened_at: madrid(2, 17, 12).toISOString(), status: "cerrada", resolution: "Temperatura recuperada a 3,4 °C a los 40 minutos",
    closed_at: madrid(2, 17, 55).toISOString(),
  });
  if (e2) throw e2;
}
console.log("Datos de prueba creados:");
console.log(`  Admin:     ${DEMO.admin.email} / ${DEMO.admin.password}`);
console.log(`  Encargada: ${DEMO.manager.email} / ${DEMO.manager.password} (Centro, Puerto y Móstoles)`);
console.log(`  PIN de todos los locales: ${DEMO.pin}`);
