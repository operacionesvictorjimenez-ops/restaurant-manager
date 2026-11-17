import Link from "next/link";
import { Building2, ChevronDown, Lock, LogOut } from "lucide-react";
import type { Session } from "@/lib/session";
import { KIND_LABEL } from "@/lib/session";
import { lock } from "@/app/bloqueo/actions";
import { logout } from "@/app/login/actions";

export function TopBar({ session, restaurantName }: { session: Session; restaurantName?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {restaurantName &&
        (session.kind === "kiosk" ? (
          <div className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-bold">
            <Building2 className="size-5 text-accent" />
            {restaurantName}
          </div>
        ) : (
          <Link href="/restaurantes" className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-bold hover:bg-surface-2">
            <Building2 className="size-5 text-accent" />
            {restaurantName}
            <ChevronDown className="size-4 text-muted" />
          </Link>
        ))}
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden text-sm text-muted sm:inline">
          {session.kind === "kiosk" ? KIND_LABEL.kiosk : `${session.fullName} · ${KIND_LABEL[session.kind]}`}
        </span>
        <form action={session.kind === "kiosk" ? lock : logout}>
          <button className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-bold hover:bg-surface-2">
            {session.kind === "kiosk" ? <Lock className="size-5" /> : <LogOut className="size-5" />}
            {session.kind === "kiosk" ? "Bloquear" : "Salir"}
          </button>
        </form>
      </div>
    </div>
  );
}
