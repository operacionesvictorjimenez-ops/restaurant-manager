import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UserKind = "admin" | "manager" | "kiosk";
export type Session = { userId: string; email: string; kind: UserKind; fullName: string };

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, kind, active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !profile.active) return null;
  return { userId: user.id, email: user.email ?? "", kind: profile.kind as UserKind, fullName: profile.full_name };
});

export async function requireSession(kinds?: UserKind[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (kinds && !kinds.includes(s.kind)) redirect("/");
  return s;
}

export const KIND_LABEL: Record<UserKind, string> = {
  admin: "Administrador general",
  manager: "Encargado",
  kiosk: "Tablet del local",
};
