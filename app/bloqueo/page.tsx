import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { formatToday } from "@/lib/format";
import { PinPad } from "./pin-pad";

export const metadata = { title: "Introduce el PIN · Restaurant Manager" };

export default async function LockPage() {
  const session = await requireSession();
  if (session.kind !== "kiosk") redirect("/");
  const supabase = await createClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name, code")
    .eq("kiosk_user_id", session.userId)
    .maybeSingle();

  return (
    <main className="grid min-h-full place-items-center px-4 py-10">
      <div className="grid w-full max-w-sm justify-items-center gap-6 text-center">
        <div className="grid size-16 place-items-center rounded-2xl bg-accent text-white">
          <Lock className="size-8" />
        </div>
        <div className="grid gap-1">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted">{restaurant?.code}</p>
          <h1 className="font-display text-4xl font-bold leading-none">{restaurant?.name ?? "Tablet sin restaurante"}</h1>
          <p className="text-muted">{formatToday()}</p>
        </div>
        <p className="text-lg font-semibold">Introduce el PIN del local</p>
        <PinPad />
      </div>
    </main>
  );
}
