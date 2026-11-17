import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Carga el restaurante por slug. RLS devuelve null si el usuario no tiene acceso. */
export const getRestaurant = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("restaurants")
    .select("id, code, name, slug, timezone, settings, active")
    .eq("slug", slug)
    .maybeSingle();
  if (!data || !data.active) notFound();
  return data;
});
