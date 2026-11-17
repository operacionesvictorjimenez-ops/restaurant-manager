import Link from "next/link";
import { Thermometer, Tag, BookOpen, PlayCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { greeting, formatToday } from "@/lib/format";
import { cx, Pill } from "@/components/ui";
import { getRestaurant } from "./data";

type Tile = { href: string; title: string; text: string; icon: LucideIcon; tone: string; phase: string };

export default async function RestaurantHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await getRestaurant(slug);
  const base = `/r/${r.slug}`;
  const tiles: Tile[] = [
    { href: `${base}/temperaturas`, title: "Registrar temperaturas", text: "Control de cámaras", icon: Thermometer, tone: "bg-frz-soft text-frz", phase: "Fase 1" },
    { href: `${base}/etiquetas`, title: "Imprimir etiqueta", text: "Caducidad secundaria", icon: Tag, tone: "bg-warn-soft text-warn", phase: "Fase 2" },
    { href: `${base}/recetas`, title: "Recetario", text: "Platos y escandallos", icon: BookOpen, tone: "bg-ok-soft text-ok", phase: "Fase 3" },
    { href: `${base}/formacion`, title: "Formación", text: "Vídeos y protocolos", icon: PlayCircle, tone: "bg-accent-soft text-accent", phase: "Fase 4" },
    { href: `${base}/incidencias`, title: "Incidencias", text: "Abiertas y cerradas", icon: TriangleAlert, tone: "bg-crit-soft text-crit", phase: "Fase 1" },
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
            className="grid min-h-36 content-start gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-accent">
            <div className="flex items-start justify-between gap-2">
              <span className={cx("grid size-13 place-items-center rounded-xl", t.tone)}>
                <t.icon className="size-7" strokeWidth={1.8} />
              </span>
              <Pill tone="muted">{t.phase}</Pill>
            </div>
            <span className="text-lg font-bold leading-tight">{t.title}</span>
            <span className="text-sm text-muted">{t.text}</span>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-dashed border-line bg-surface p-6">
        <p className="font-bold">Estado de las cámaras</p>
        <p className="text-muted">
          Aquí aparecerán las cámaras de este restaurante con su última temperatura en cuanto activemos el módulo de temperaturas (Fase 1).
        </p>
      </div>
    </>
  );
}
