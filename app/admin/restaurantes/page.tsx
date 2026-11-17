import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { Card, Field, PageTitle, Pill, inputClass } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { createRestaurant } from "../actions";
import { DEFAULT_UNIT_COUNTS } from "@/lib/units";

export const metadata = { title: "Restaurantes · Administración" };

export default async function AdminRestaurants() {
  const session = await requireSession(["admin", "manager"]);
  const supabase = await createClient();
  const [{ data: restaurants }, { data: withPin }] = await Promise.all([
    supabase.from("restaurants").select("id, code, name, address, active, kiosk_user_id").order("code"),
    supabase.rpc("restaurants_with_pin"),
  ]);
  const pinSet = new Set((withPin as string[] | null) ?? []);

  return (
    <>
      <PageTitle sub={`${restaurants?.length ?? 0} restaurantes${session.kind === "manager" ? " autorizados" : ""}`}>
        Restaurantes
      </PageTitle>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted">
            <tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">PIN</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {restaurants?.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-3 font-mono font-bold">{r.code}</td>
                <td className="px-4 py-3"><span className="font-semibold">{r.name}</span>{r.address && <span className="block text-muted">{r.address}</span>}</td>
                <td className="px-4 py-3">{pinSet.has(r.id) ? <Pill tone="ok">Configurado</Pill> : <Pill tone="warn">Sin PIN</Pill>}</td>
                <td className="px-4 py-3">{r.active ? <Pill tone="ok">Activo</Pill> : <Pill tone="muted">Desactivado</Pill>}</td>
                <td className="px-4 py-3 text-right"><Link href={`/admin/restaurantes/${r.id}`} className="font-bold text-accent">Abrir</Link></td>
              </tr>
            ))}
            {!restaurants?.length && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Todavía no hay restaurantes.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {session.kind === "admin" && (
        <Card className="grid max-w-2xl gap-4">
          <h2 className="font-display text-2xl font-bold">Nuevo restaurante</h2>
          <ActionForm action={createRestaurant}>
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <Field label="Código" hint="Ej.: MAD-01">
                <input id="new-code" name="code" required maxLength={12} className={`${inputClass} uppercase`} />
              </Field>
              <Field label="Nombre">
                <input id="new-name" name="name" required className={inputClass} />
              </Field>
            </div>
            <Field label="Dirección (opcional)">
              <input id="new-address" name="address" className={inputClass} />
            </Field>
            <Field label="PIN del local" hint="4 a 6 cifras. Lo usará todo el equipo en la tablet.">
              <input id="new-pin" name="pin" required inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} className={`${inputClass} max-w-40 font-mono`} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cámaras de refrigeración" hint="Se crean CR-1, CR-2… (0 a 4 °C)">
                <input id="new-cr" name="cr_count" type="number" min={0} max={20} defaultValue={DEFAULT_UNIT_COUNTS.refrigeracion} className={`${inputClass} max-w-32`} />
              </Field>
              <Field label="Cámaras de congelación" hint="Se crean CF-1, CF-2… (≤ −18 °C)">
                <input id="new-cf" name="cf_count" type="number" min={0} max={20} defaultValue={DEFAULT_UNIT_COUNTS.congelacion} className={`${inputClass} max-w-32`} />
              </Field>
            </div>
            <SubmitButton pendingText="Creando…" className="justify-self-start">Crear restaurante</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </>
  );
}
