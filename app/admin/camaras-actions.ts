"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { createStandardUnits } from "@/lib/units";
import { DEFAULT_RANGE } from "@/lib/temperature";

export type FormState = { error?: string; ok?: string } | null;

const num = (msg: string) =>
  z.string().trim().transform((s, ctx) => {
    const n = Number(s.replace("−", "-").replace(",", "."));
    if (!s || !Number.isFinite(n) || n < -50 || n > 40) {
      ctx.addIssue({ code: "custom", message: msg });
      return z.NEVER;
    }
    return Math.round(n * 10) / 10;
  });

const unitSchema = z.object({
  restaurant_id: z.string().uuid(),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,10}$/, "Código de 1 a 10 letras, números o guiones (p. ej. CR-5)."),
  name: z.string().trim().min(1, "Escribe el nombre.").max(60),
  kind: z.enum(["refrigeracion", "congelacion"]),
});

function done(rid: string, msg: string): FormState {
  revalidatePath(`/admin/restaurantes/${rid}/camaras`);
  revalidatePath("/r/[slug]", "layout");
  return { ok: msg };
}

export async function addUnit(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession(["admin", "manager"]);
  const p = unitSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();
  const { count } = await supabase.from("storage_units").select("id", { count: "exact", head: true }).eq("restaurant_id", p.data.restaurant_id);
  const { error } = await supabase.from("storage_units").insert({
    ...p.data,
    min_c: DEFAULT_RANGE[p.data.kind].min,
    max_c: DEFAULT_RANGE[p.data.kind].max,
    sort_order: ((count ?? 0) + 1) * 10,
  });
  if (error) return { error: error.code === "23505" ? "Ya existe una cámara con ese código." : "No se ha podido crear la cámara." };
  return done(p.data.restaurant_id, `Cámara ${p.data.code} creada.`);
}

export async function updateUnit(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession(["admin", "manager"]);
  const p = z.object({
    id: z.string().uuid(),
    restaurant_id: z.string().uuid(),
    name: z.string().trim().min(1, "Escribe el nombre.").max(60),
    min_c: num("Temperatura mínima no válida."),
    max_c: num("Temperatura máxima no válida."),
    active: z.enum(["on"]).optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  if (p.data.min_c >= p.data.max_c) return { error: "La mínima debe ser menor que la máxima." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("storage_units")
    .update({ name: p.data.name, min_c: p.data.min_c, max_c: p.data.max_c, active: p.data.active === "on" })
    .eq("id", p.data.id).select("code");
  if (error || !data?.length) return { error: "No se han podido guardar los cambios." };
  return done(p.data.restaurant_id, `${data[0].code} guardada.`);
}

export async function addStandardUnits(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession(["admin", "manager"]);
  const p = z.object({
    restaurant_id: z.string().uuid(),
    cr_count: z.coerce.number().int().min(0).max(20),
    cf_count: z.coerce.number().int().min(0).max(20),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Indica cuántas cámaras de cada tipo (0 a 20)." };
  const supabase = await createClient();
  const { created, error } = await createStandardUnits(supabase, p.data.restaurant_id, {
    refrigeracion: p.data.cr_count, congelacion: p.data.cf_count,
  });
  if (error) return { error: "No se han podido crear las cámaras." };
  return done(p.data.restaurant_id, created ? `${created} cámaras creadas.` : "Esas cámaras ya existían.");
}

export async function saveSchedule(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession(["admin", "manager"]);
  const rid = String(fd.get("restaurant_id"));
  const raw = String(fd.get("times") ?? "");
  const times = [...new Set(raw.split(/[\s,;]+/).filter(Boolean).map((t) => t.replace(".", ":").replace(/^(\d):/, "0$1:")))].sort();
  if (!times.length || times.length > 8 || !times.every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))
    return { error: "Escribe entre 1 y 8 horas separadas por comas, por ejemplo: 09:00, 17:00" };
  const tolerance = Number(fd.get("tolerance"));
  if (!Number.isInteger(tolerance) || tolerance < 10 || tolerance > 240) return { error: "El margen debe estar entre 10 y 240 minutos." };
  const supabase = await createClient();
  const { error } = await supabase.from("temperature_settings")
    .upsert({ restaurant_id: rid, check_times: times, tolerance_minutes: tolerance, updated_at: new Date().toISOString() });
  if (error) return { error: "No se ha podido guardar el horario." };
  return done(rid, `Horario guardado: ${times.join(", ")}.`);
}
