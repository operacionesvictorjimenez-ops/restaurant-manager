import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { fmtC, KIND_LABEL, type StorageKind } from "@/lib/temperature";
import { DEFAULT_UNIT_COUNTS } from "@/lib/units";
import { Card, Field, PageTitle, Pill, inputClass } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { addStandardUnits, addUnit, saveSchedule, updateUnit } from "../../../camaras-actions";

export const metadata = { title: "Cámaras · Administración" };

export default async function UnitsAdmin({ params }: { params: Promise<{ id: string }> }) {
  await requireSession(["admin", "manager"]);
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: r }, { data: units }, { data: settings }] = await Promise.all([
    supabase.from("restaurants").select("id, name, code").eq("id", id).maybeSingle(),
    supabase.from("storage_units").select("id, code, name, kind, min_c, max_c, active").eq("restaurant_id", id).order("sort_order").order("code"),
    supabase.from("temperature_settings").select("check_times, tolerance_minutes").eq("restaurant_id", id).maybeSingle(),
  ]);
  if (!r) notFound();
  const times = ((settings?.check_times as string[] | undefined) ?? ["09:00", "17:00"]).map((t) => t.slice(0, 5));
  const small = `${inputClass} min-h-11`;

  return (
    <>
      <Link href={`/admin/restaurantes/${id}`} className="flex items-center gap-2 text-sm font-semibold text-muted"><ArrowLeft className="size-4" />{r.name}</Link>
      <PageTitle sub={`${units?.filter((u) => u.active).length ?? 0} cámaras activas`}>Cámaras · {r.name}</PageTitle>

      <Card className="grid gap-4">
        <h2 className="font-display text-2xl font-bold">Horario de controles</h2>
        <ActionForm action={saveSchedule} className="grid gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
          <input type="hidden" name="restaurant_id" value={id} />
          <Field label="Horas de control" hint="Separadas por comas. Ej.: 09:00, 17:00">
            <input id="times" name="times" defaultValue={times.join(", ")} className={inputClass} />
          </Field>
          <Field label="Margen (minutos)" hint="Después se marca como atrasado">
            <input id="tolerance" name="tolerance" type="number" min={10} max={240} defaultValue={settings?.tolerance_minutes ?? 60} className={inputClass} />
          </Field>
          <SubmitButton>Guardar horario</SubmitButton>
        </ActionForm>
      </Card>

      <div className="grid gap-3">
        <h2 className="font-display text-2xl font-bold">Cámaras y rangos</h2>
        {units?.length ? (
          units.map((u) => (
            <Card key={u.id} className={u.active ? "" : "opacity-60"}>
              <ActionForm action={updateUnit} className="grid items-end gap-3 md:grid-cols-[110px_1fr_110px_110px_auto_auto]">
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="restaurant_id" value={id} />
                <div className="grid gap-1">
                  <span className="font-mono text-lg font-bold">{u.code}</span>
                  <Pill tone={u.kind === "congelacion" ? "accent" : "muted"}>{KIND_LABEL[u.kind as StorageKind]}</Pill>
                </div>
                <Field label="Nombre"><input id={`n-${u.id}`} name="name" defaultValue={u.name} className={small} /></Field>
                <Field label="Mín. °C"><input id={`min-${u.id}`} name="min_c" inputMode="decimal" defaultValue={fmtC(Number(u.min_c))} className={`${small} font-mono`} /></Field>
                <Field label="Máx. °C"><input id={`max-${u.id}`} name="max_c" inputMode="decimal" defaultValue={fmtC(Number(u.max_c))} className={`${small} font-mono`} /></Field>
                <label className="flex min-h-11 items-center gap-2 font-semibold">
                  <input id={`a-${u.id}`} type="checkbox" name="active" defaultChecked={u.active} className="size-5 accent-accent" />Activa
                </label>
                <SubmitButton variant="ghost" className="min-h-11">Guardar</SubmitButton>
              </ActionForm>
            </Card>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-6 text-muted">Todavía no hay cámaras. Crea las estándar o añade una a una.</p>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="grid content-start gap-4">
          <h2 className="font-display text-2xl font-bold">Crear cámaras estándar</h2>
          <p className="text-muted">Crea CR-1, CR-2… y CF-1, CF-2… con rangos por defecto. Las que ya existan no se duplican.</p>
          <ActionForm action={addStandardUnits}>
            <input type="hidden" name="restaurant_id" value={id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Refrigeración (0 a 4 °C)"><input id="std-cr" name="cr_count" type="number" min={0} max={20} defaultValue={DEFAULT_UNIT_COUNTS.refrigeracion} className={inputClass} /></Field>
              <Field label="Congelación (≤ −18 °C)"><input id="std-cf" name="cf_count" type="number" min={0} max={20} defaultValue={DEFAULT_UNIT_COUNTS.congelacion} className={inputClass} /></Field>
            </div>
            <SubmitButton className="justify-self-start">Crear cámaras</SubmitButton>
          </ActionForm>
        </Card>
        <Card className="grid content-start gap-4">
          <h2 className="font-display text-2xl font-bold">Añadir una cámara</h2>
          <ActionForm action={addUnit}>
            <input type="hidden" name="restaurant_id" value={id} />
            <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
              <Field label="Código"><input id="u-code" name="code" required maxLength={10} placeholder="CR-8" className={`${inputClass} uppercase`} /></Field>
              <Field label="Nombre"><input id="u-name" name="name" required placeholder="Cámara de pescado" className={inputClass} /></Field>
            </div>
            <Field label="Tipo">
              <select id="u-kind" name="kind" className={inputClass}>
                <option value="refrigeracion">Refrigeración (0 a 4 °C)</option>
                <option value="congelacion">Congelación (≤ −18 °C)</option>
              </select>
            </Field>
            <SubmitButton className="justify-self-start">Añadir cámara</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
