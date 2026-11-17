"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Delete, TriangleAlert } from "lucide-react";
import { cx } from "@/components/ui";
import { CORRECTIVE_ACTIONS, fmtC, formatRange, inRange, parseTemp, type Unit } from "@/lib/temperature";
import { recordReading, type ReadingInput } from "../actions";
import { enqueueReading, newClientId } from "@/components/reading-queue";

type Step = "valor" | "accion";

export function RecordForm({ unit, doneHref, nextHref }: { unit: Unit; doneHref: string; nextHref: string | null }) {
  const router = useRouter();
  const [negative, setNegative] = useState(unit.kind === "congelacion");
  const [digits, setDigits] = useState("");
  const [step, setStep] = useState<Step>("valor");
  const [action, setAction] = useState("");
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [clientId, setClientId] = useState(newClientId);

  const text = `${negative ? "−" : ""}${digits || "0"}`;
  const value = digits ? parseTemp(`${negative ? "-" : ""}${digits}`) : null;
  const outOfRange = value !== null && !inRange(value, unit);

  const press = (k: string) => {
    setError(null);
    setDigits((d) => {
      if (k === ",") return d.includes(",") || !d ? d : d + ",";
      if (d.includes(",")) return d.split(",")[1].length >= 1 ? d : d + k;
      return d.replace(/^0/, "").length >= 2 ? d : (d === "0" ? k : d + k);
    });
  };

  const finish = (msg: string) => {
    const target = nextHref ?? doneHref;
    router.push(`${target}${target.includes("?") ? "&" : "?"}guardado=${encodeURIComponent(msg)}`);
    router.refresh();
  };

  const submit = () => {
    if (value === null) return setError("Escribe la temperatura.");
    if (outOfRange && step === "valor") return setStep("accion");
    const chosen = action === "otra" ? other.trim() : action;
    if (outOfRange && !chosen) return setError("Elige la acción correctora que has aplicado.");

    const input: ReadingInput = {
      unitId: unit.id, value, clientId, recordedAt: new Date().toISOString(),
      action: outOfRange ? chosen : undefined,
      note: note.trim() || undefined,
    };
    start(async () => {
      try {
        const r = await recordReading(input);
        if (!r.ok) {
          if (r.needsAction) setStep("accion");
          return setError(r.error);
        }
        finish(`${unit.code}: ${fmtC(value)} °C${r.incident ? " · incidencia abierta" : ""}`);
      } catch {
        // Sin conexión: se guarda en la tablet y se envía sola al volver la red.
        enqueueReading(input);
        setOffline(`${unit.code}: ${fmtC(value)} °C guardada en la tablet. Se enviará al volver la conexión.`);
        setDigits("");
        setClientId(newClientId());
        setStep("valor");
        setAction("");
      }
    });
  };

  if (step === "accion") {
    return (
      <div className="grid gap-4">
        <div className="flex items-start gap-3 rounded-2xl bg-crit-soft p-4 text-crit">
          <TriangleAlert className="mt-0.5 size-7 shrink-0" />
          <div>
            <p className="text-lg font-bold">{fmtC(value!)} °C está fuera de rango ({formatRange(unit)})</p>
            <p className="text-sm">Indica qué has hecho. Se abrirá una incidencia y habrá que volver a medir en 30 minutos.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {[...CORRECTIVE_ACTIONS, "otra"].map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => { setAction(a); setError(null); }}
              className={cx(
                "min-h-16 rounded-xl border px-4 py-3 text-left font-semibold",
                action === a ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-line bg-surface",
              )}
            >
              {a === "otra" ? "Otra acción…" : a}
            </button>
          ))}
        </div>
        {action === "otra" && (
          <input id="other-action" autoFocus value={other} onChange={(e) => setOther(e.target.value)} maxLength={200}
            placeholder="Describe la acción" className="min-h-14 rounded-xl border border-line bg-surface px-4 text-lg" />
        )}
        <input id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
          placeholder="Observaciones (opcional)" className="min-h-12 rounded-xl border border-line bg-surface px-4" />
        {error && <p role="alert" className="rounded-xl bg-crit-soft px-4 py-3 font-semibold text-crit">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => { setStep("valor"); setError(null); }}
            className="min-h-16 rounded-2xl border border-line bg-surface text-lg font-bold">Corregir valor</button>
          <button type="button" onClick={submit} disabled={pending}
            className="min-h-16 rounded-2xl bg-crit text-lg font-bold text-white disabled:opacity-50">
            {pending ? "Guardando…" : "Guardar e informar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div
        aria-live="polite"
        className={cx(
          "rounded-2xl border-2 bg-surface p-4 text-center font-mono text-6xl font-bold tnum",
          outOfRange ? "border-crit text-crit" : "border-accent",
        )}
      >
        {text}<span className="text-3xl text-muted"> °C</span>
      </div>
      {outOfRange && (
        <p className="text-center font-semibold text-crit">Fuera de rango ({formatRange(unit)})</p>
      )}
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
          <button key={k} type="button" onClick={() => press(k)}
            className="h-18 rounded-2xl border border-line bg-surface font-mono text-3xl font-bold active:bg-accent-soft">{k}</button>
        ))}
        <button type="button" onClick={() => setNegative((n) => !n)} aria-pressed={negative}
          className={cx("h-18 rounded-2xl border font-mono text-3xl font-bold", negative ? "border-frz bg-frz-soft text-frz" : "border-line bg-surface-2")}>
          ±
        </button>
        <button type="button" onClick={() => press("0")}
          className="h-18 rounded-2xl border border-line bg-surface font-mono text-3xl font-bold active:bg-accent-soft">0</button>
        <button type="button" onClick={() => press(",")}
          className="h-18 rounded-2xl border border-line bg-surface font-mono text-3xl font-bold active:bg-accent-soft">,</button>
      </div>
      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <button type="button" onClick={() => setDigits((d) => d.slice(0, -1))} aria-label="Borrar"
          className="grid h-18 place-items-center rounded-2xl border border-line bg-surface-2"><Delete className="size-7" /></button>
        <button type="button" onClick={submit} disabled={pending || !digits}
          className={cx("flex h-18 items-center justify-center gap-2 rounded-2xl text-xl font-bold text-white disabled:opacity-40",
            outOfRange ? "bg-crit" : "bg-accent")}>
          <Check className="size-7" />
          {pending ? "Guardando…" : outOfRange ? "Continuar" : "Guardar"}
        </button>
      </div>
      {error && <p role="alert" className="rounded-xl bg-crit-soft px-4 py-3 font-semibold text-crit">{error}</p>}
      {offline && <p role="status" className="rounded-xl bg-warn-soft px-4 py-3 font-semibold text-warn">{offline}</p>}
    </div>
  );
}
