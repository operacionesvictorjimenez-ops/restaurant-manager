import { CheckCircle2 } from "lucide-react";

export function SavedBanner({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div role="status" className="flex items-center gap-3 rounded-2xl bg-ok-soft px-4 py-3 font-semibold text-ok">
      <CheckCircle2 className="size-6 shrink-0" />
      Guardado · {text}
    </div>
  );
}
