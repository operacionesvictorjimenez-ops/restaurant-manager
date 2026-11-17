import { notFound } from "next/navigation";
import { Construction } from "lucide-react";
import { LinkButton } from "@/components/ui";

const MODULES: Record<string, { name: string; phase: string }> = {
  temperaturas: { name: "Temperaturas", phase: "Fase 1" },
  incidencias: { name: "Incidencias", phase: "Fase 1" },
  etiquetas: { name: "Etiquetas", phase: "Fase 2" },
  recetas: { name: "Recetario", phase: "Fase 3" },
  formacion: { name: "Formación", phase: "Fase 4" },
};

/** Marcador temporal para los módulos que se construyen en fases siguientes. */
export default async function ModulePlaceholder({ params }: { params: Promise<{ slug: string; modulo: string }> }) {
  const { slug, modulo } = await params;
  const m = MODULES[modulo];
  if (!m) notFound();
  return (
    <div className="grid justify-items-center gap-4 rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
      <Construction className="size-12 text-muted" />
      <h1 className="font-display text-3xl font-bold">{m.name}</h1>
      <p className="max-w-md text-muted">Este módulo se construye en la {m.phase}. Lo verás aquí en cuanto esté probado.</p>
      <LinkButton href={`/r/${slug}`} variant="ghost">Volver al inicio</LinkButton>
    </div>
  );
}
