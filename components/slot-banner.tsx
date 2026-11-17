import { Clock } from "lucide-react";
import { cx } from "@/components/ui";
import type { Board } from "@/lib/temperature-data";

/** Resumen del control en curso: "Control de las 09:00 · 3 de 7 cámaras". */
export function SlotBanner({ board, now = new Date() }: { board: Board; now?: Date }) {
  const total = board.units.length;
  if (!total) return null;
  const { current, next, doneInSlot } = board;
  const complete = current && doneInSlot >= total;
  const late = current && !complete && now > current.deadline;
  const tone = !current || complete ? "bg-ok-soft text-ok" : late ? "bg-crit-soft text-crit" : "bg-warn-soft text-warn";
  return (
    <div className={cx("flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-3 font-semibold", tone)}>
      <Clock className="size-6 shrink-0" />
      {current ? (
        <span>
          Control de las {current.label}: {doneInSlot} de {total} cámaras
          {complete ? " · completo" : late ? " · atrasado" : ` · hasta las ${new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(current.deadline)}`}
        </span>
      ) : (
        <span>Aún no toca ningún control hoy</span>
      )}
      {next && <span className="font-normal opacity-80">Próximo control: {next.label}</span>}
    </div>
  );
}
