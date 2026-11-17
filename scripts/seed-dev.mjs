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
  ],
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
}
console.log("Datos de prueba creados:");
console.log(`  Admin:     ${DEMO.admin.email} / ${DEMO.admin.password}`);
console.log(`  Encargada: ${DEMO.manager.email} / ${DEMO.manager.password} (Centro y Puerto)`);
console.log(`  PIN de los tres locales: ${DEMO.pin}`);
