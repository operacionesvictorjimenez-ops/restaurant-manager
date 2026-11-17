/**
 * Reglas de temperaturas en la base de datos (Supabase local con npm run db:reset).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
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

let mostoles: SupabaseClient, playa: SupabaseClient, manager: SupabaseClient;
let unit: { id: string; restaurant_id: string };
let playaId: string;

beforeAll(async () => {
  mostoles = await as("tablet-mostoles@kiosk.restaurant-manager.app", "Kiosk-MOSTOLES-dev-2026");
  playa = await as("tablet-playa@kiosk.restaurant-manager.app", "Kiosk-PLAYA-dev-2026");
  manager = await as("encargada@demo.local", "Encargada-Demo-2026");
  const { data: r } = await svc.from("restaurants").select("id, code");
  const mid = r!.find((x) => x.code === "MOSTOLES")!.id;
  playaId = r!.find((x) => x.code === "PLAYA")!.id;
  const { data: u } = await svc.from("storage_units").select("id, restaurant_id").eq("restaurant_id", mid).eq("code", "CR-1").single();
  unit = u!;
});

const record = (c: SupabaseClient, value: number, extra: Record<string, unknown> = {}) =>
  c.rpc("record_temperature", { p_unit: unit.id, p_value: value, p_client_id: randomUUID(), ...extra });

describe("cámaras del piloto", () => {
  it("Móstoles tiene 4 de refrigeración y 3 de congelación", async () => {
    const { data } = await mostoles.from("storage_units").select("code, kind").order("code");
    expect(data?.map((u) => u.code)).toEqual(["CF-1", "CF-2", "CF-3", "CR-1", "CR-2", "CR-3", "CR-4"]);
  });
  it("la tablet no ve cámaras de otros locales", async () => {
    const { data } = await playa.from("storage_units").select("id").eq("restaurant_id", unit.restaurant_id);
    expect(data).toEqual([]);
  });
});

describe("registro de lecturas", () => {
  it("guarda una lectura correcta", async () => {
    const { data, error } = await record(mostoles, 2.4);
    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: true, in_range: true, incident_id: null });
  });
  it("fuera de rango sin acción correctora se rechaza", async () => {
    const { error } = await record(mostoles, 7.2);
    expect(error?.hint).toBe("action_required");
  });
  it("fuera de rango con acción correctora abre una incidencia", async () => {
    const { data } = await record(mostoles, 7.2, { p_action: "Puerta mal cerrada: cerrada y revisada" });
    expect(data).toMatchObject({ ok: true, in_range: false });
    const { data: inc } = await mostoles.from("incidents").select("status, title, corrective_action").eq("id", data.incident_id).single();
    expect(inc).toMatchObject({ status: "abierta", corrective_action: "Puerta mal cerrada: cerrada y revisada" });
    expect(inc!.title).toContain("7,2 °C");
  });
  it("reenviar la misma lectura (cola sin conexión) no la duplica", async () => {
    const id = randomUUID();
    const a = await mostoles.rpc("record_temperature", { p_unit: unit.id, p_value: 3, p_client_id: id });
    const b = await mostoles.rpc("record_temperature", { p_unit: unit.id, p_value: 3, p_client_id: id });
    expect(b.data).toMatchObject({ duplicate: true, id: a.data.id });
    const { count } = await svc.from("temperature_readings").select("id", { count: "exact", head: true }).eq("client_id", id);
    expect(count).toBe(1);
  });
  it("acepta lecturas guardadas sin conexión de hace unas horas", async () => {
    const { error } = await record(mostoles, 3.1, { p_recorded_at: new Date(Date.now() - 3 * 3600_000).toISOString() });
    expect(error).toBeNull();
  });
  it("rechaza lecturas de hace más de 24 horas", async () => {
    const { error } = await record(mostoles, 3.1, { p_recorded_at: new Date(Date.now() - 48 * 3600_000).toISOString() });
    expect(error?.message).toMatch(/hora/);
  });
  it("rechaza valores imposibles", async () => {
    const { error } = await record(mostoles, 99);
    expect(error?.message).toMatch(/no es posible/);
  });
  it("otra tablet no puede registrar en una cámara de Móstoles", async () => {
    const { error } = await record(playa, 3);
    expect(error?.message).toMatch(/no encontrada/);
  });
  it("las lecturas no se pueden modificar ni borrar", async () => {
    const { data: one } = await mostoles.from("temperature_readings").select("id").limit(1).single();
    const upd = await mostoles.from("temperature_readings").update({ value_c: 1 }).eq("id", one!.id);
    const del = await mostoles.from("temperature_readings").delete().eq("id", one!.id);
    const ins = await mostoles.from("temperature_readings").insert({ restaurant_id: unit.restaurant_id, storage_unit_id: unit.id, value_c: 1, in_range: true, min_c: 0, max_c: 4 });
    expect(upd.error).not.toBeNull();
    expect(del.error).not.toBeNull();
    expect(ins.error).not.toBeNull();
    const { data: still } = await svc.from("temperature_readings").select("id").eq("id", one!.id);
    expect(still).toHaveLength(1);
  });
});

describe("incidencias y configuración", () => {
  it("la tablet no puede cerrar incidencias", async () => {
    const { data: inc } = await mostoles.from("incidents").select("id").eq("status", "abierta").limit(1).single();
    const { error } = await mostoles.rpc("close_incident", { p_id: inc!.id, p_resolution: "ok" });
    expect(error?.message).toMatch(/permiso/);
  });
  it("la encargada cierra la incidencia con su resolución", async () => {
    const { data: inc } = await manager.from("incidents").select("id").eq("status", "abierta").eq("restaurant_id", unit.restaurant_id).limit(1).single();
    expect((await manager.rpc("close_incident", { p_id: inc!.id, p_resolution: "" })).error?.message).toMatch(/resuelto/);
    expect((await manager.rpc("close_incident", { p_id: inc!.id, p_resolution: "Recuperada a 3,2 °C" })).error).toBeNull();
    const { data } = await svc.from("incidents").select("status, closed_by").eq("id", inc!.id).single();
    expect(data?.status).toBe("cerrada");
    expect(data?.closed_by).not.toBeNull();
  });
  it("la tablet no puede cambiar los rangos de una cámara", async () => {
    const { data } = await mostoles.from("storage_units").update({ max_c: 10 }).eq("id", unit.id).select();
    expect(data ?? []).toEqual([]);
  });
  it("la encargada sí puede ajustar los rangos de su local", async () => {
    const { data } = await manager.from("storage_units").update({ max_c: 5 }).eq("id", unit.id).select("max_c");
    expect(Number(data?.[0].max_c)).toBe(5);
    await manager.from("storage_units").update({ max_c: 4 }).eq("id", unit.id);
  });
  it("la encargada no puede crear cámaras en un local no autorizado", async () => {
    const { error } = await manager.from("storage_units").insert({ restaurant_id: playaId, code: "X-1", name: "X", kind: "refrigeracion", min_c: 0, max_c: 4 });
    expect(error).not.toBeNull();
  });
  it("la encargada puede definir el horario de controles", async () => {
    const { error } = await manager.from("temperature_settings").upsert({ restaurant_id: unit.restaurant_id, check_times: ["09:00", "17:00"], tolerance_minutes: 60 });
    expect(error).toBeNull();
  });
});
