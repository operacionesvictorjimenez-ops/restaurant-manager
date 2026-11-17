/**
 * Pruebas de aislamiento entre restaurantes contra Supabase local.
 * Requiere: npm run db:start && npm run db:reset
 */
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "../scripts/env.mjs";

loadEnv();
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const svc = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function as(email: string, password: string) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

let admin: SupabaseClient, manager: SupabaseClient, playa: SupabaseClient, centro: SupabaseClient;
let ids: Record<string, string>;

beforeAll(async () => {
  admin = await as("admin@demo.local", "Admin-Demo-2026");
  manager = await as("encargada@demo.local", "Encargada-Demo-2026");
  playa = await as("tablet-playa@kiosk.restaurant-manager.app", "Kiosk-PLAYA-dev-2026");
  centro = await as("tablet-centro@kiosk.restaurant-manager.app", "Kiosk-CENTRO-dev-2026");
  const { data } = await svc.from("restaurants").select("id, code");
  ids = Object.fromEntries((data ?? []).map((r) => [r.code, r.id]));
  // Estado limpio de intentos de PIN
  await admin.rpc("set_restaurant_pin", { rid: ids.PLAYA, pin: "1234" });
  await admin.rpc("set_restaurant_pin", { rid: ids.CENTRO, pin: "1234" });
});

const codes = async (c: SupabaseClient) =>
  ((await c.from("restaurants").select("code").order("code")).data ?? []).map((r) => r.code);

describe("visibilidad de restaurantes", () => {
  it("el administrador general ve todos", async () => {
    const all = ((await svc.from("restaurants").select("code").order("code")).data ?? []).map((r) => r.code);
    expect(all.length).toBeGreaterThanOrEqual(3);
    expect(await codes(admin)).toEqual(all);
  });
  it("la encargada solo ve los autorizados", async () => {
    expect(await codes(manager)).toEqual(["CENTRO", "MOSTOLES", "PUERTO"]);
  });
  it("la tablet solo ve su propio local", async () => {
    expect(await codes(playa)).toEqual(["PLAYA"]);
  });
  it("un visitante sin sesión no ve nada", async () => {
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    expect(await codes(anon)).toEqual([]);
  });
});

describe("escrituras protegidas", () => {
  it("la encargada no puede crear restaurantes", async () => {
    const { data: org } = await svc.from("organizations").select("id").single();
    const { error } = await manager.from("restaurants").insert({ organization_id: org!.id, code: "HACK", slug: "hack", name: "Hack" });
    expect(error).not.toBeNull();
  });
  it("la tablet no puede renombrar su restaurante", async () => {
    const { data } = await playa.from("restaurants").update({ name: "Otro" }).eq("id", ids.PLAYA).select();
    expect(data).toEqual([]);
  });
  it("nadie puede escribir en el histórico de actividad", async () => {
    const { error } = await admin.from("audit_log").insert({ table_name: "x", action: "y" });
    expect(error).not.toBeNull();
  });
  it("la encargada no puede cambiar el PIN de un local no autorizado", async () => {
    const { error } = await manager.rpc("set_restaurant_pin", { rid: ids.PLAYA, pin: "9999" });
    expect(error?.message).toMatch(/permiso/);
  });
  it("la encargada sí puede cambiar el PIN de su local", async () => {
    const { error } = await manager.rpc("set_restaurant_pin", { rid: ids.CENTRO, pin: "1234" });
    expect(error).toBeNull();
  });
  it("el hash del PIN no es accesible por la API", async () => {
    const { error } = await admin.schema("private" as never).from("restaurant_pins").select("*");
    expect(error).not.toBeNull();
  });
});

describe("PIN del local", () => {
  it("acepta el PIN correcto", async () => {
    const { data } = await centro.rpc("verify_restaurant_pin", { pin: "1234" });
    expect(data).toMatchObject({ ok: true, restaurant_id: ids.CENTRO });
  });
  it("informa de intentos restantes y bloquea tras 5 fallos", async () => {
    const r1 = (await playa.rpc("verify_restaurant_pin", { pin: "0000" })).data;
    expect(r1).toMatchObject({ ok: false, reason: "wrong_pin", remaining: 4 });
    for (let i = 0; i < 3; i++) await playa.rpc("verify_restaurant_pin", { pin: "0000" });
    const r5 = (await playa.rpc("verify_restaurant_pin", { pin: "0000" })).data;
    expect(r5).toMatchObject({ ok: false, reason: "locked" });
    const after = (await playa.rpc("verify_restaurant_pin", { pin: "1234" })).data;
    expect(after).toMatchObject({ ok: false, reason: "locked" });
  });
  it("cambiar el PIN desbloquea la tablet", async () => {
    await admin.rpc("set_restaurant_pin", { rid: ids.PLAYA, pin: "1234" });
    const { data } = await playa.rpc("verify_restaurant_pin", { pin: "1234" });
    expect(data).toMatchObject({ ok: true });
  });
  it("una cuenta que no es tablet no puede probar PIN", async () => {
    const { data } = await manager.rpc("verify_restaurant_pin", { pin: "1234" });
    expect(data).toMatchObject({ ok: false, reason: "not_kiosk" });
  });
  it("queda registrado en el histórico", async () => {
    const { data } = await admin.from("audit_log").select("action").eq("restaurant_id", ids.PLAYA).eq("action", "pin_locked");
    expect(data?.length).toBeGreaterThan(0);
  });
});
