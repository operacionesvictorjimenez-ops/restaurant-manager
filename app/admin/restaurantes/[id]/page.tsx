import Link from "next/link";
import { notFound } from "next/navigation";
import { Tablet, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { Card, Field, PageTitle, Pill, inputClass } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { registerTablet, setPin, updateRestaurant } from "../../actions";

export default async function RestaurantDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tablet?: string }>;
}) {
  const { id } = await params;
  const { tablet } = await searchParams;
  const session = await requireSession(["admin", "manager"]);
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("restaurants")
    .select("id, code, name, slug, address, active, settings, kiosk_user_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();
  const { data: pin } = await supabase.rpc("restaurant_pin_status", { rid: id });
  const pinStatus = pin as { configured: boolean; locked_until: string | null; updated_at: string | null } | null;
  const settings = (r.settings ?? {}) as { idle_lock_minutes?: number };
  const isAdmin = session.kind === "admin";

  return (
    <>
      <Link href="/admin/restaurantes" className="flex items-center gap-2 text-sm font-semibold text-muted"><ArrowLeft className="size-4" />Restaurantes</Link>
      <PageTitle sub={<><span className="font-mono font-bold">{r.code}</span> · {r.active ? "Activo" : "Desactivado"}</>}>{r.name}</PageTitle>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="grid content-start gap-4">
          <h2 className="font-display text-2xl font-bold">PIN del local</h2>
          <div className="flex flex-wrap gap-2">
            {pinStatus?.configured ? <Pill tone="ok">Configurado</Pill> : <Pill tone="warn">Sin PIN</Pill>}
            {pinStatus?.updated_at && <Pill tone="muted">Cambiado el {formatDateTime(pinStatus.updated_at)}</Pill>}
            {pinStatus?.locked_until && <Pill tone="crit">Bloqueado por intentos fallidos</Pill>}
          </div>
          <ActionForm action={setPin}>
            <input type="hidden" name="id" value={r.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nuevo PIN"><input id="pin" name="pin" required inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} className={`${inputClass} font-mono`} /></Field>
              <Field label="Repite el PIN"><input id="pin2" name="pin2" required inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} className={`${inputClass} font-mono`} /></Field>
            </div>
            <SubmitButton className="justify-self-start">Cambiar PIN</SubmitButton>
          </ActionForm>
        </Card>

        <Card className="grid content-start gap-4">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold"><Tablet className="size-6 text-accent" />Tablet del local</h2>
          <p className="text-muted">
            Abre esta página en la tablet de la cocina y pulsa el botón. Se cerrará tu sesión en ese dispositivo y quedará como tablet de
            <b className="text-ink"> {r.name}</b>, pidiendo el PIN del local para entrar.
          </p>
          {tablet === "sin-cuenta" && <p className="rounded-xl bg-crit-soft px-4 py-3 text-sm font-semibold text-crit">Este restaurante no tiene cuenta de tablet. Contacta con soporte.</p>}
          <form action={registerTablet} className="grid gap-3">
            <input type="hidden" name="id" value={r.id} />
            <label className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-4">
              <input id="confirm" type="checkbox" name="confirm" className="mt-1 size-5 accent-accent" />
              <span className={tablet === "confirmar" ? "font-semibold text-crit" : ""}>Entiendo que se cerrará mi sesión en este dispositivo.</span>
            </label>
            <SubmitButton disabled={!pinStatus?.configured} pendingText="Registrando…" className="justify-self-start">
              Usar este dispositivo como tablet del local
            </SubmitButton>
            {!pinStatus?.configured && <p className="text-sm text-warn">Configura primero el PIN.</p>}
          </form>
        </Card>

        {isAdmin && (
          <Card className="grid content-start gap-4">
            <h2 className="font-display text-2xl font-bold">Datos del restaurante</h2>
            <ActionForm action={updateRestaurant}>
              <input type="hidden" name="id" value={r.id} />
              <Field label="Nombre"><input id="name" name="name" defaultValue={r.name} required className={inputClass} /></Field>
              <Field label="Dirección"><input id="address" name="address" defaultValue={r.address ?? ""} className={inputClass} /></Field>
              <Field label="Bloqueo automático de la tablet" hint="Minutos sin tocar la pantalla antes de volver a pedir el PIN.">
                <input id="idle" name="idle_lock_minutes" type="number" min={1} max={60} defaultValue={settings.idle_lock_minutes ?? 5} className={`${inputClass} max-w-32`} />
              </Field>
              <label className="flex items-center gap-3">
                <input id="active" type="checkbox" name="active" defaultChecked={r.active} className="size-5 accent-accent" />
                <span className="font-semibold">Restaurante activo</span>
              </label>
              <SubmitButton className="justify-self-start">Guardar</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
