import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireSession, KIND_LABEL } from "@/lib/session";
import { Card, Field, PageTitle, Pill, inputClass } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { createPerson } from "../actions";
import { RestaurantChecklist } from "./person-fields";

export const metadata = { title: "Encargados · Administración" };

export default async function People() {
  await requireSession(["admin"]);
  const supabase = await createClient();
  const [{ data: people }, { data: links }, { data: restaurants }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, kind, active").in("kind", ["admin", "manager"]).order("full_name"),
    supabase.from("manager_restaurants").select("profile_id, restaurant_id"),
    supabase.from("restaurants").select("id, code, name").eq("active", true).order("code"),
  ]);
  const count = new Map<string, number>();
  links?.forEach((l) => count.set(l.profile_id, (count.get(l.profile_id) ?? 0) + 1));

  return (
    <>
      <PageTitle sub="Responsables con email y contraseña. Los equipos de cocina entran con el PIN del local.">Encargados</PageTitle>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted">
            <tr><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3">Restaurantes</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {people?.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-4 py-3 font-semibold">{p.full_name}</td>
                <td className="px-4 py-3">{KIND_LABEL[p.kind as "admin" | "manager"]}</td>
                <td className="px-4 py-3 tnum">{p.kind === "admin" ? "Todos" : count.get(p.id) ?? 0}</td>
                <td className="px-4 py-3">{p.active ? <Pill tone="ok">Activo</Pill> : <Pill tone="muted">Desactivado</Pill>}</td>
                <td className="px-4 py-3 text-right"><Link href={`/admin/encargados/${p.id}`} className="font-bold text-accent">Abrir</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Card className="grid max-w-3xl gap-4">
        <h2 className="font-display text-2xl font-bold">Nueva persona</h2>
        <ActionForm action={createPerson}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo"><input id="p-name" name="full_name" required className={inputClass} /></Field>
            <Field label="Email"><input id="p-email" name="email" type="email" required className={inputClass} /></Field>
            <Field label="Contraseña inicial" hint="Mínimo 10 caracteres. Entrégala en persona.">
              <input id="p-pass" name="password" type="text" required minLength={10} className={`${inputClass} font-mono`} />
            </Field>
            <Field label="Rol">
              <select id="p-kind" name="kind" className={inputClass} defaultValue="manager">
                <option value="manager">Encargado</option>
                <option value="admin">Administrador general</option>
              </select>
            </Field>
          </div>
          <RestaurantChecklist restaurants={restaurants ?? []} />
          <SubmitButton pendingText="Creando…" className="justify-self-start">Crear persona</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
