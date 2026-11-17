import Link from "next/link";
import { Thermometer, Tag, BookOpen, PlayCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { greeting, formatToday } from "@/lib/format";
import { getTemperatureBoard } from "@/lib/temperature-data";
import { STATUS_META } from "@/lib/temperature";
import { cx, Pill } from "@/components/ui";
import { UnitCard } from "@/components/unit-card";
import { SlotBanner } from "@/components/slot-banner";
import { getRestaurant } from "./data";

type Tile = { href: string; title: string; text: string; icon: LucideIcon; tone: string; phase?: string; alert?: boolean };

export default async function RestaurantHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await getRestaurant(slug);
  const base = `/r/${r.slug}`;
  const board = await getTemperatureBoard(r.id, r.timezone);
  const total = board.units.length;
  const toDo = board.units.filter((u) => u.status !== "ok");
  const tempText = !total
    ? "Sin cámaras configuradas"
    : board.current
      ? `Control ${board.current.label}: ${board.doneInSlot} de ${total}`
      : board.next ? `Próximo control: ${board.next.label}` : "Controles de hoy hechos";

  const tiles: Tile[] = [
    { href: `${base}/temperaturas`, title: "Registrar temperaturas", text: tempText, icon: Thermometer,
      tone: toDo.some((u) => STATUS_META[u.status].tone === "crit") ? "bg-crit-soft text-crit" : "bg-frz-soft text-frz",
      alert: toDo.length > 0 },
    { href: `${base}/incidencias`, title: "Incidencias", text: board.openIncidents ? `${board.openIncidents} abiertas` : "Ninguna abierta",
      icon: TriangleAlert, tone: board.openIncidents ? "bg-crit-soft text-crit" : "bg-ok-soft text-ok" },
    { href: `${base}/etiquetas`, title: "Imprimir etiqueta", text: "Caducidad secundaria", icon: Tag, tone: "bg-warn-soft text-warn", phase: "Fase 2" },
    { href: `${base}/recetas`, title: "Recetario", text: "Platos y escandallos", icon: BookOpen, tone: "bg-ok-soft text-ok", phase: "Fase 3" },
    { href: `${base}/formacion`, title: "Formación", text: "Vídeos y protocolos", icon: PlayCircle, tone: "bg-accent-soft text-accent", phase: "Fase 4" },
  ];

  return (
    <>
      <div className="grid gap-1">
        <h1 className="font-display text-4xl font-bold leading-none">{greeting()}</h1>
        <p className="text-muted">{formatToday(r.timezone)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <Link key={t.title} href={t.href}
            className={cx("grid min-h-36 content-start gap-3 rounded-2xl border bg-surface p-4 hover:border-accent",
              t.alert ? "border-warn" : "border-line", t.phase && "opacity-70")}>
            <div className="flex items-start justify-between gap-2">
              <span className={cx("grid size-13 place-items-center rounded-xl", t.tone)}>
                <t.icon className="size-7" strokeWidth={1.8} />
              </span>
              {t.phase && <Pill tone="muted">{t.phase}</Pill>}
            </div>
            <span className="text-lg font-bold leading-tight">{t.title}</span>
            <span className="text-sm text-muted">{t.text}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="grid content-start gap-3 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">Cámaras</h2>
            <Link href={`${base}/temperaturas`} className="text-sm font-bold text-accent">Registrar</Link>
          </div>
          {total ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {board.units.map((u) => (
                <UnitCard key={u.id} u={u} compact href={`${base}/temperaturas/${u.id}`} tz={r.timezone} />
              ))}
            </div>
          ) : (
            <p className="text-muted">Este restaurante aún no tiene cámaras configuradas.</p>
          )}
        </section>
        <section className="grid content-start gap-3 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-bold">Pendiente ahora</h2>
          <SlotBanner board={board} />
          {toDo.length ? (
            <ul className="divide-y divide-line">
              {toDo.map((u) => (
                <li key={u.id}>
                  <Link href={`${base}/temperaturas/${u.id}`} className="flex items-center gap-3 py-2.5">
                    <Pill tone={STATUS_META[u.status].tone}>{STATUS_META[u.status].label}</Pill>
                    <span className="font-semibold">{u.code}</span>
                    <span className="truncate text-muted">{u.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            total > 0 && <p className="text-muted">Todo al día.</p>
          )}
        </section>
      </div>
    </>
  );
}
