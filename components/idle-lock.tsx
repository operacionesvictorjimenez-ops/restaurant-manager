"use client";
import { useEffect, useRef } from "react";
import { lock } from "@/app/bloqueo/actions";

/** Vuelve a pedir el PIN tras unos minutos sin tocar la pantalla. */
export function IdleLock({ minutes }: { minutes: number }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => lock(), minutes * 60_000);
    };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [minutes]);
  return null;
}
