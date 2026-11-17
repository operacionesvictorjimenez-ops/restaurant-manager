import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession, KIND_LABEL } from "@/lib/session";
import { Card, PageTitle } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { updatePerson } from "../../actions";
import { RestaurantChecklist } from "../person-fields";

export default async function PersonDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireSession(["admin"]);
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: p }, { data: links }, { data: restaurants }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, kind, active").eq("id", id).in("kind", ["admin", "manager"]).maybeSingle(),
    supabase.from("manager_restaurants").select("restaurant_id").eq("profile_id", id),
    supabase.from("restaurants").select("id, code, name").eq("active", true).order("code"),
  ]);
  if (!p) notFound();

  return (
    <>
      <Link href="/admin/encargados" className="flex items-center gap-2 text-sm font-semibold text-muted"><ArrowLeft className="size-4" />Encargados</Link>
      <PageTitle sub={KIND_LABEL[p.kind as "admin" | "manager"]}>{p.full_name}</PageTitle>
      <Card className="grid max-w-3xl gap-4">
        <ActionForm action={updatePerson}>
          <input type="hidden" name="id" value={p.id} />
          <label className="flex items-center gap-3">
            <input id="active" type="checkbox" name="active" defaultChecked={p.active} className="size-5 accent-accent" />
            <span className="font-semibold">Cuenta activa</span>
          </label>
          {p.kind === "manager" ? (
            <RestaurantChecklist restaurants={restaurants ?? []} selected={new Set((links ?? []).map((l) => l.restaurant_id))} />
          ) : (
            <p className="text-muted">El administrador general tiene acceso a todos los restaurantes.</p>
          )}
          <SubmitButton className="justify-self-start">Guardar</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
