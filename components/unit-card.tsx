import Link from "next/link";
import { Snowflake, Refrigerator } from "lucide-react";
import { cx } from "@/components/ui";
import { fmtC, formatRange, formatWhen, STATUS_META } from "@/lib/temperature";
import type { BoardUnit } from "@/lib/temperature-data";

const BORDER = { ok: "border-t-ok", warn: "border-t-warn", crit: "border-t-crit" };
const BG = { ok: "bg-surface", warn: "bg-warn-soft/40", crit: "bg-crit-soft/50" };
const TEXT = { ok: "text-ok", warn: "text-warn", crit: "text-crit" };

export function UnitCard({ u, href, tz, compact }: { u: BoardUnit; href: string; tz: string; compact?: boolean }) {
  const meta = STATUS_META[u.status];
  const Icon = u.kind === "congelacion" ? Snowflake : Refrigerator;
  return (
    <Link
      href={href}
      className={cx(
        "grid content-start gap-1.5 rounded-2xl border border-line border-t-[6px] p-4 hover:border-accent",
        BORDER[meta.tone], BG[meta.tone],
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-bold">
          <Icon className={cx("size-5", u.kind === "congelacion" ? "text-frz" : "text-accent")} />
          {u.code}
        </span>
        <span className={cx("text-xs font-bold", TEXT[meta.tone])}>{meta.label}</span>
      </div>
      {!compact && <span className="truncate text-sm text-muted">{u.name}</span>}
      <span className={cx("font-mono font-bold tnum", compact ? "text-2xl" : "text-4xl")}>
        {u.last ? `${fmtC(u.last.value_c)}°` : "—"}
      </span>
      <span className="text-xs text-muted">
        {u.last ? `${formatWhen(u.last.recorded_at, tz)} · ` : "Sin lecturas · "}
        {formatRange(u)}
      </span>
    </Link>
  );
}
