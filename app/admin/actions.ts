"use server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/session";
import { slugify } from "@/lib/format";
import { UNLOCK_COOKIE } from "@/lib/unlock";
import { createStandardUnits, DEFAULT_UNIT_COUNTS } from "@/lib/units";

export type FormState = { error?: string; ok?: string } | null;

const strongPassword = () => randomBytes(24).toString("base64url");
const kioskEmail = (code: string) => `tablet-${code.toLowerCase()}@kiosk.restaurant-manager.app`;

// ---------------------------------------------------------------- Restaurantes

const restaurantSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,12}$/, "El código lleva de 2 a 12 letras, números o guiones (p. ej. MAD-01)."),
  name: z.string().trim().min(2, "Escribe el nombre del restaurante.").max(80),
  address: z.string().trim().max(200).optional(),
  pin: z.string().regex(/^[0-9]{4,6}$/, "El PIN debe tener entre 4 y 6 cifras."),
  cr_count: z.coerce.number().int().min(0, "Número de cámaras no válido.").max(20, "Máximo 20 cámaras de cada tipo.").default(DEFAULT_UNIT_COUNTS.refrigeracion),
  cf_count: z.coerce.number().int().min(0, "Número de cámaras no válido.").max(20, "Máximo 20 cámaras de cada tipo.").default(DEFAULT_UNIT_COUNTS.congelacion),
});

export async function createRestaurant(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession(["admin"]);
  const parsed = restaurantSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { code, name, address, pin, cr_count, cf_count } = parsed.data;

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "No hay ninguna organización configurada." };

  const { data: r, error } = await supabase
    .from("restaurants")
    .insert({ organization_id: org.id, code, name, address: address || null, slug: slugify(`${name}`) || code.toLowerCase() })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Ya existe un restaurante con ese código o nombre." };
    return { error: "No se ha podido crear el restaurante." };
  }

  // Cuenta de la tablet del local
  const admin = createAdminClient();
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: kioskEmail(code),
    password: strongPassword(),
    email_confirm: true,
    app_metadata: { kind: "kiosk", restaurant_id: r.id },
  });
  if (authErr || !created.user) return { error: "Restaurante creado, pero falló la cuenta de la tablet. Vuelve a intentarlo desde su ficha." };
  await admin.from("profiles").insert({ id: created.user.id, full_name: `Tablet ${name}`, kind: "kiosk" });
  await supabase.from("restaurants").update({ kiosk_user_id: created.user.id }).eq("id", r.id);

  const { error: pinErr } = await supabase.rpc("set_restaurant_pin", { rid: r.id, pin });
  if (pinErr) return { error: "Restaurante creado, pero no se pudo guardar el PIN." };

  const { error: unitsErr } = await createStandardUnits(supabase, r.id, { refrigeracion: cr_count, congelacion: cf_count });
  if (unitsErr) return { error: "Restaurante creado, pero no se pudieron crear las cámaras. Créalas desde su ficha." };

  revalidatePath("/admin/restaurantes");
  redirect(`/admin/restaurantes/${r.id}`);
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2, "Escribe el nombre del restaurante.").max(80),
  address: z.string().trim().max(200).optional(),
  idle_lock_minutes: z.coerce.number().int().min(1).max(60),
  active: z.enum(["on"]).optional(),
});

export async function updateRestaurant(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession(["admin"]);
  const parsed = updateSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, name, address, idle_lock_minutes, active } = parsed.data;
  const supabase = await createClient();
  const { data: current } = await supabase.from("restaurants").select("settings").eq("id", id).single();
  const { error } = await supabase
    .from("restaurants")
    .update({
      name,
      address: address || null,
      active: active === "on",
      settings: { ...(current?.settings as object), idle_lock_minutes },
    })
    .eq("id", id);
  if (error) return { error: "No se han podido guardar los cambios." };
  revalidatePath(`/admin/restaurantes/${id}`);
  return { ok: "Cambios guardados." };
}

export async function setPin(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession(["admin", "manager"]);
  const rid = String(fd.get("id"));
  const pin = String(fd.get("pin") ?? "");
  if (pin !== String(fd.get("pin2") ?? "")) return { error: "Los dos PIN no coinciden." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_restaurant_pin", { rid, pin });
  if (error) return { error: error.message };
  revalidatePath(`/admin/restaurantes/${rid}`);
  return { ok: "PIN actualizado. Las tablets lo pedirán la próxima vez que se bloqueen." };
}

/**
 * Convierte el dispositivo actual en la tablet del local: cierra la sesión del
 * responsable y abre la de la cuenta del restaurante, que pedirá el PIN.
 */
export async function registerTablet(fd: FormData) {
  await requireSession(["admin", "manager"]);
  const rid = String(fd.get("id"));
  if (fd.get("confirm") !== "on") redirect(`/admin/restaurantes/${rid}?tablet=confirmar`);

  const supabase = await createClient();
  const { data: can } = await supabase.rpc("can_manage_restaurant", { rid });
  if (!can) redirect("/admin/restaurantes");
  const { data: r } = await supabase.from("restaurants").select("kiosk_user_id").eq("id", rid).single();
  if (!r?.kiosk_user_id) redirect(`/admin/restaurantes/${rid}?tablet=sin-cuenta`);

  const admin = createAdminClient();
  const { data: u } = await admin.auth.admin.getUserById(r.kiosk_user_id);
  if (!u.user?.email) redirect(`/admin/restaurantes/${rid}?tablet=sin-cuenta`);
  const password = strongPassword();
  await admin.auth.admin.updateUserById(r.kiosk_user_id, { password });

  await supabase.auth.signOut({ scope: "local" });
  const { error } = await supabase.auth.signInWithPassword({ email: u.user.email, password });
  if (error) redirect("/login");
  (await cookies()).delete(UNLOCK_COOKIE);
  redirect("/bloqueo");
}

// ---------------------------------------------------------------- Encargados

const personSchema = z.object({
  full_name: z.string().trim().min(2, "Escribe el nombre completo.").max(80),
  email: z.string().trim().toLowerCase().email("El email no es válido."),
  password: z.string().min(10, "La contraseña inicial debe tener al menos 10 caracteres."),
  kind: z.enum(["manager", "admin"]),
});

export async function createPerson(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession(["admin"]);
  const parsed = personSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { full_name, email, password, kind } = parsed.data;
  const restaurantIds = fd.getAll("restaurants").map(String);

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { kind },
  });
  if (error || !created.user)
    return { error: error?.message.includes("already") ? "Ya existe una cuenta con ese email." : "No se ha podido crear la cuenta." };
  await admin.from("profiles").insert({ id: created.user.id, full_name, kind });

  const supabase = await createClient();
  if (kind === "manager" && restaurantIds.length) {
    await supabase.from("manager_restaurants").insert(restaurantIds.map((restaurant_id) => ({ profile_id: created.user.id, restaurant_id })));
  }
  revalidatePath("/admin/encargados");
  redirect(`/admin/encargados/${created.user.id}`);
}

export async function updatePerson(_: FormState, fd: FormData): Promise<FormState> {
  const session = await requireSession(["admin"]);
  const id = String(fd.get("id"));
  const active = fd.get("active") === "on";
  const wanted = new Set(fd.getAll("restaurants").map(String));
  if (id === session.userId && !active) return { error: "No puedes desactivar tu propia cuenta." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
  if (error) return { error: "No se han podido guardar los cambios." };

  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });

  const { data: current } = await supabase.from("manager_restaurants").select("restaurant_id").eq("profile_id", id);
  const have = new Set((current ?? []).map((c) => c.restaurant_id));
  const toAdd = [...wanted].filter((r) => !have.has(r));
  const toRemove = [...have].filter((r) => !wanted.has(r));
  if (toAdd.length) await supabase.from("manager_restaurants").insert(toAdd.map((restaurant_id) => ({ profile_id: id, restaurant_id })));
  if (toRemove.length) await supabase.from("manager_restaurants").delete().eq("profile_id", id).in("restaurant_id", toRemove);

  revalidatePath(`/admin/encargados/${id}`);
  return { ok: "Cambios guardados." };
}
