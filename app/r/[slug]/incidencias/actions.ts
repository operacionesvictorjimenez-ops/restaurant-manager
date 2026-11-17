"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";

export type FormState = { error?: string; ok?: string } | null;

export async function closeIncident(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession(["admin", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_incident", {
    p_id: String(fd.get("id")),
    p_resolution: String(fd.get("resolution") ?? ""),
  });
  if (error) return { error: error.message };
  revalidatePath("/r/[slug]", "layout");
  return { ok: "Incidencia cerrada." };
}
