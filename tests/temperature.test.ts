import { describe, expect, it } from "vitest";
import {
  currentSlot, fmtC, formatRange, nextSlot, parseTemp, todaySlots, unitStatus, zonedInstant,
} from "@/lib/temperature";

const TZ = "Europe/Madrid";

describe("horas en la zona del restaurante", () => {
  it("convierte hora de invierno (UTC+1)", () => {
    expect(zonedInstant("2026-11-18", "09:00", TZ).toISOString()).toBe("2026-11-18T08:00:00.000Z");
  });
  it("convierte hora de verano (UTC+2)", () => {
    expect(zonedInstant("2026-07-01", "09:00", TZ).toISOString()).toBe("2026-07-01T07:00:00.000Z");
  });
  it("funciona el día del cambio de hora de octubre", () => {
    expect(zonedInstant("2026-10-25", "17:00", TZ).toISOString()).toBe("2026-10-25T16:00:00.000Z");
  });
});

describe("controles del día", () => {
  const now = new Date("2026-11-18T12:00:00Z"); // 13:00 en Madrid
  const slots = todaySlots(["17:00:00", "09:00:00"], 60, TZ, now);
  it("ordena los controles", () => {
    expect(slots.map((s) => s.label)).toEqual(["09:00", "17:00"]);
  });
  it("el control en curso es el de las 09:00 y el siguiente el de las 17:00", () => {
    expect(currentSlot(slots, now)?.label).toBe("09:00");
    expect(nextSlot(slots, now)?.label).toBe("17:00");
  });
  it("antes del primer control no hay control en curso", () => {
    expect(currentSlot(slots, new Date("2026-11-18T06:00:00Z"))).toBeNull();
  });
});

describe("estado de una cámara", () => {
  const slots = todaySlots(["09:00"], 60, TZ, new Date("2026-11-18T12:00:00Z"));
  const slot = slots[0]; // 08:00Z a 09:00Z
  const ok = (iso: string) => ({ value_c: 3, recorded_at: iso, in_range: true });

  it("pendiente dentro de la tolerancia", () => {
    expect(unitStatus(null, slot, null, new Date("2026-11-18T08:30:00Z"))).toBe("pendiente");
  });
  it("atrasado al pasar la tolerancia", () => {
    expect(unitStatus(ok("2026-11-17T16:00:00Z"), slot, null, new Date("2026-11-18T09:30:00Z"))).toBe("atrasado");
  });
  it("correcta si se midió después de la hora del control", () => {
    expect(unitStatus(ok("2026-11-18T08:10:00Z"), slot, null, new Date("2026-11-18T09:30:00Z"))).toBe("ok");
  });
  it("fuera de rango manda sobre todo lo demás", () => {
    const bad = { value_c: 7, recorded_at: "2026-11-18T08:10:00Z", in_range: false };
    expect(unitStatus(bad, slot, "2026-11-18T08:10:00Z", new Date("2026-11-18T09:30:00Z"))).toBe("fuera");
  });
  it("con incidencia abierta y la nueva lectura correcta, deja de pedir remedir", () => {
    expect(unitStatus(ok("2026-11-18T08:45:00Z"), slot, "2026-11-18T08:10:00Z", new Date("2026-11-18T09:30:00Z"))).toBe("ok");
  });
});

describe("formato y lectura de temperaturas", () => {
  it("usa coma decimal y signo menos tipográfico", () => {
    expect(fmtC(-18)).toBe("−18,0");
    expect(fmtC(3.45)).toBe("3,5");
  });
  it("interpreta lo tecleado", () => {
    expect(parseTemp("−3,5")).toBe(-3.5);
    expect(parseTemp("4")).toBe(4);
    expect(parseTemp("-18.2")).toBe(-18.2);
    expect(parseTemp("abc")).toBeNull();
    expect(parseTemp("3,55")).toBeNull();
    expect(parseTemp("")).toBeNull();
  });
  it("muestra el rango de congelación como límite superior", () => {
    expect(formatRange({ kind: "congelacion", min_c: -40, max_c: -18 })).toBe("≤ −18,0 °C");
    expect(formatRange({ kind: "refrigeracion", min_c: 0, max_c: 4 })).toBe("0,0 a 4,0 °C");
  });
});
