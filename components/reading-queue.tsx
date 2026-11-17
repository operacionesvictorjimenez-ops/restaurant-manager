"use client";
import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { recordReading, type ReadingInput } from "@/app/r/[slug]/temperaturas/actions";

const KEY = "rm_pending_readings";
const EVENT = "rm-queue-change";

function read(): ReadingInput[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
function write(items: ReadingInput[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Guarda en la tablet una lectura que no se pudo enviar. */
export function enqueueReading(item: ReadingInput) {
  write([...read().filter((i) => i.clientId !== item.clientId), item]);
}

let flushing = false;
export async function flushQueue() {
  if (flushing) return;
  flushing = true;
  try {
    for (const item of read()) {
      try {
        const r = await recordReading(item);
        // Guardada, o rechazada por un motivo que no se arregla reintentando.
        if (r.ok || r.permanent || r.needsAction) write(read().filter((i) => i.clientId !== item.clientId));
      } catch {
        break; // sigue sin conexión
      }
    }
  } finally {
    flushing = false;
  }
}

/** Reenvía la cola al recuperar la conexión y muestra cuántas lecturas esperan. */
export function QueueSync() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(read().length);
    const flush = () => flushQueue().then(update);
    update();
    flush();
    const id = setInterval(flush, 60_000);
    window.addEventListener("online", flush);
    window.addEventListener(EVENT, update);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", flush);
      window.removeEventListener(EVENT, update);
    };
  }, []);
  if (!count) return null;
  return (
    <div role="status" className="flex items-center gap-2 rounded-xl bg-warn-soft px-4 py-3 text-sm font-semibold text-warn">
      <CloudOff className="size-5" />
      {count === 1 ? "1 lectura guardada en la tablet" : `${count} lecturas guardadas en la tablet`}, pendiente de enviar. Se enviará sola al volver la conexión.
    </div>
  );
}

export function newClientId(): string {
  const c = globalThis.crypto as Crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
