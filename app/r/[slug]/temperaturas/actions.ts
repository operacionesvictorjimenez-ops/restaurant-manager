"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReadingInput = {
  unitId: string;
  value: number;
  clientId: string;
  recordedAt?: string;
  action?: string;
  note?: string;
};

export type ReadingResult =
  | { ok: true; inRange: boolean; incident: boolean }
  | { ok: false; error: string; needsAction?: boolean; permanent?: boolean };

export async function recordReading(input: ReadingInput): Promise<ReadingResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_temperature", {
    p_unit: input.unitId,
    p_value: input.value,
    p_client_id: input.clientId,
    p_recorded_at: input.recordedAt ?? null,
    p_action: input.action ?? null,
    p_note: input.note ?? null,
  });
  if (error) {
    if (error.hint === "action_required") return { ok: false, needsAction: true, error: error.message };
    // Errores de validación o permisos: reenviar no servirá de nada.
    const permanent = ["22023", "42501", "P0001"].includes(error.code ?? "");
    return { ok: false, error: permanent ? error.message : "No se ha podido guardar. Revisa la conexión.", permanent };
  }
  revalidatePath("/r/[slug]", "layout");
  const res = data as { in_range?: boolean; incident_id?: string | null; duplicate?: boolean };
  return { ok: true, inRange: res.in_range ?? true, incident: !!res.incident_id };
}
