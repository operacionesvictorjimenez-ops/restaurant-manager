import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";

/** Lleva a cada usuario a su sitio: la tablet a su local, el encargado a su local o al selector. */
export default async function Home() {
  const session = await requireSession();
  const supabase = await createClient();

  if (session.kind === "kiosk") {
    const { data } = await supabase.from("restaurants").select("slug").eq("kiosk_user_id", session.userId).maybeSingle();
    if (!data) redirect("/bloqueo");
    redirect(`/r/${data.slug}`);
  }

  const { data: list } = await supabase.from("restaurants").select("slug").eq("active", true).limit(2);
  if (list && list.length === 1) redirect(`/r/${list[0].slug}`);
  redirect("/restaurantes");
}
