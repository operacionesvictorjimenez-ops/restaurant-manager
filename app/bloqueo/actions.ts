"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UNLOCK_COOKIE, UNLOCK_TTL_SECONDS, signUnlock } from "@/lib/unlock";
import { formatDateTime } from "@/lib/format";

export type PinState = { error?: string } | null;

export async function unlock(_: PinState, formData: FormData): Promise<PinState> {
  const pin = String(formData.get("pin") ?? "");
  if (!/^[0-9]{4,6}$/.test(pin)) return { error: "El PIN tiene entre 4 y 6 cifras." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("verify_restaurant_pin", { pin });
  if (error) return { error: "No se ha podido comprobar el PIN. Revisa la conexión y vuelve a intentarlo." };

  const res = data as { ok: boolean; reason?: string; remaining?: number; locked_until?: string };
  if (!res.ok) {
    switch (res.reason) {
      case "wrong_pin":
        return { error: `PIN incorrecto. Te quedan ${res.remaining} intentos.` };
      case "locked":
        return { error: `Demasiados intentos. Tablet bloqueada hasta las ${formatDateTime(res.locked_until!).split(" ")[1]}.` };
      case "no_pin":
        return { error: "Este restaurante aún no tiene PIN. Pide al encargado que lo configure." };
      default:
        return { error: "Esta tablet no está registrada en ningún restaurante activo." };
    }
  }

  const token = await signUnlock(user.id, process.env.RM_UNLOCK_SECRET!);
  (await cookies()).set(UNLOCK_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UNLOCK_TTL_SECONDS,
  });
  redirect("/");
}

export async function lock() {
  (await cookies()).delete(UNLOCK_COOKIE);
  redirect("/bloqueo");
}
