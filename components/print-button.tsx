"use client";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()}
      className="flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 font-bold text-white print:hidden">
      <Printer className="size-5" />Imprimir o guardar en PDF
    </button>
  );
}
