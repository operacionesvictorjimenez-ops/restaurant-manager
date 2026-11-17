import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHistory, parsePeriod } from "@/lib/temperature-data";
import { fmtC, KIND_LABEL, formatRange } from "@/lib/temperature";

/** Exporta el histórico en CSV para Excel (separador ;, coma decimal, UTF-8 con BOM). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: r } = await supabase.from("restaurants").select("id, code, name, timezone").eq("slug", slug).maybeSingle();
  if (!r) return new NextResponse("No encontrado", { status: 404 });

  const sp = req.nextUrl.searchParams;
  const period = parsePeriod(r.timezone, sp.get("desde") ?? undefined, sp.get("hasta") ?? undefined);
  const cam = sp.get("camara");
  const { rows, units } = await getHistory(r.id, period, cam && /^[0-9a-f-]{36}$/.test(cam) ? cam : undefined);
  const byUnit = new Map(units.map((u) => [u.id, u]));

  const date = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: r.timezone });
  const time = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: r.timezone });
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [
    ["Restaurante", "Fecha", "Hora", "Cámara", "Nombre", "Tipo", "Temperatura (°C)", "Rango", "Estado", "Acción correctora", "Notas"].join(";"),
    ...rows.map((x) => {
      const u = byUnit.get(x.unit_id)!;
      const d = new Date(x.recorded_at);
      return [
        r.name, date.format(d), time.format(d), u.code, u.name, KIND_LABEL[u.kind],
        fmtC(x.value_c).replace("−", "-"), formatRange({ ...u, min_c: x.min_c, max_c: x.max_c }),
        x.in_range ? "Correcta" : "Fuera de rango", x.action ?? "", x.note ?? "",
      ].map((v) => esc(String(v))).join(";");
    }),
  ];
  const body = "﻿" + lines.join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="temperaturas-${r.code}-${period.from}_${period.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
