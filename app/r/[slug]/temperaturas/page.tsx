import { History, FileText, TriangleAlert, Settings } from "lucide-react";
import { getTemperatureBoard } from "@/lib/temperature-data";
import { getSession } from "@/lib/session";
import { UnitCard } from "@/components/unit-card";
import { SlotBanner } from "@/components/slot-banner";
import { SavedBanner } from "@/components/saved-banner";
import { LinkButton } from "@/components/ui";
import { getRestaurant } from "../data";

export const metadata = { title: "Temperaturas · Restaurant Manager" };

export default async function Temperatures({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ guardado?: string }>;
}) {
  const { slug } = await params;
  const { guardado } = await searchParams;
  const r = await getRestaurant(slug);
  const session = await getSession();
  const board = await getTemperatureBoard(r.id, r.timezone);
  const base = `/r/${r.slug}/temperaturas`;
  const canManage = session?.kind === "admin" || session?.kind === "manager";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl font-bold leading-none">Temperaturas</h1>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`${base}/historial`} variant="ghost"><History className="size-5" />Histórico</LinkButton>
          <LinkButton href={`${base}/informe`} variant="ghost"><FileText className="size-5" />Informe</LinkButton>
          <LinkButton href={`/r/${r.slug}/incidencias`} variant="ghost">
            <TriangleAlert className="size-5" />Incidencias{board.openIncidents ? ` (${board.openIncidents})` : ""}
          </LinkButton>
        </div>
      </div>
      <SavedBanner text={guardado} />
      <SlotBanner board={board} />
      {board.units.length ? (
        <>
          <p className="text-muted">Toca una cámara para registrar su temperatura.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {board.units.map((u) => (
              <UnitCard key={u.id} u={u} href={`${base}/${u.id}`} tz={r.timezone} />
            ))}
          </div>
        </>
      ) : (
        <div className="grid justify-items-start gap-3 rounded-2xl border border-dashed border-line bg-surface p-8">
          <p className="text-lg font-bold">Este restaurante todavía no tiene cámaras</p>
          <p className="text-muted">Un encargado puede crearlas desde Administración → Restaurantes → Cámaras.</p>
          {canManage && (
            <LinkButton href={`/admin/restaurantes/${r.id}/camaras`}><Settings className="size-5" />Configurar cámaras</LinkButton>
          )}
        </div>
      )}
    </>
  );
}
