"use client";
import { useActionState, useRef, useState } from "react";
import { Delete } from "lucide-react";
import { unlock } from "./actions";
import { cx } from "@/components/ui";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const MAX = 6;

export function PinPad() {
  const [pin, setPin] = useState("");
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof unlock>>, fd: FormData) => {
    const r = await unlock(prev, fd);
    setPin("");
    return r;
  }, null);
  const formRef = useRef<HTMLFormElement>(null);

  const press = (d: string) => setPin((p) => (p.length < MAX ? p + d : p));
  const back = () => setPin((p) => p.slice(0, -1));

  return (
    <form
      ref={formRef}
      action={action}
      className="grid w-full max-w-xs gap-5"
      onKeyDown={(e) => {
        if (/^[0-9]$/.test(e.key)) press(e.key);
        else if (e.key === "Backspace") back();
      }}
    >
      <input type="hidden" name="pin" value={pin} />
      <div className="flex justify-center gap-3" aria-live="polite" aria-label={`${pin.length} cifras introducidas`}>
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <span
            key={i}
            className={cx("size-5 rounded-full border-2 border-accent", i < pin.length && "bg-accent")}
          />
        ))}
      </div>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-crit-soft px-4 py-3 text-center text-sm font-semibold text-crit">
          {state.error}
        </p>
      )}
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className="h-18 rounded-2xl border border-line bg-surface font-mono text-3xl font-bold active:bg-accent-soft"
          >
            {k}
          </button>
        ))}
        <button type="button" onClick={back} aria-label="Borrar"
          className="grid h-18 place-items-center rounded-2xl border border-line bg-surface-2 active:bg-accent-soft">
          <Delete className="size-7" />
        </button>
        <button type="button" onClick={() => press("0")}
          className="h-18 rounded-2xl border border-line bg-surface font-mono text-3xl font-bold active:bg-accent-soft">
          0
        </button>
        <button type="submit" disabled={pin.length < 4 || pending}
          className="h-18 rounded-2xl bg-accent text-lg font-bold text-white disabled:opacity-40">
          {pending ? "…" : "Entrar"}
        </button>
      </div>
    </form>
  );
}
